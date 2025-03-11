// scripts/check-links.ts
import * as fs from 'fs';
import * as path from 'path';
import glob from 'glob';
import * as babel from '@babel/core';
import traverse from '@babel/traverse';
import { parse } from '@babel/parser';
import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

// Define types
interface LinkReference {
  path: string;
  file: string;
  line: number;
}

interface RouteObject {
  href: string;
  line?: number;
  [key: string]: any;
}

interface ApiRouteInfo {
  routePath: string;           // Full API route path
  filePath: string;            // Actual file path
  isDynamic: boolean;          // Whether it has dynamic segments
  params: string[];            // List of parameters in the route
}

// Store found links
const links: Set<LinkReference> = new Set();
// Store available routes
const availableRoutes: Set<string> = new Set();
// Store API routes
const apiRoutes: ApiRouteInfo[] = [];

// Configuration for exclusions
const excludePaths = [
  /^\.\/app\/api\/examples/,  // Exclude API examples folder 
  /^\.\/hooks\/use-examples\.ts$/ // Exclude use-examples.ts hook
];

// Helper function to check if a file should be excluded
function shouldExcludeFile(filePath: string): boolean {
  return excludePaths.some(pattern => pattern.test(filePath));
}

// Find all TSX/TS files in the project
const componentFiles: string[] = glob.sync('{./app,./components}/**/*.tsx')
  .filter(file => !shouldExcludeFile(file));
const hooksFiles: string[] = glob.sync('./hooks/**/*.{ts,tsx}')
  .filter(file => !shouldExcludeFile(file));
const pageFiles: string[] = glob.sync('./app/**/{page,layout}.tsx')
  .filter(file => !shouldExcludeFile(file));
// Find all API route files
const apiRouteFiles: string[] = glob.sync('./app/api/**/{route}.{ts,js,tsx,jsx}')
  .filter(file => !shouldExcludeFile(file));

// Process API routes
apiRouteFiles.forEach(file => {
  let routePath = file
    .replace('./app', '')
    .replace(/\/route\.(ts|js|tsx|jsx)$/, '')
    .replace(/\/\(.*?\)\//g, '/'); // Handle route groups
  
  const params = extractParamsFromRoute(routePath);
  const isDynamic = params.length > 0;
  
  // Add to API routes collection
  apiRoutes.push({
    routePath,
    filePath: file,
    isDynamic,
    params
  });
  
  // Convert for normal route matching (for future validation)
  const normalizedRoute = routePath.replace(/\[(.+?)\]/g, ':$1');
  // Add to available routes as an API route
  availableRoutes.add(normalizedRoute);
});

// Extract regular page routes
pageFiles.forEach(file => {
  let routePath = file
    .replace('./app', '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/layout\.tsx$/, '')
    .replace(/\/\(.*?\)\//g, '/'); // Handle route groups
  
  // Convert for normal route matching
  if (routePath === '') routePath = '/';
  const normalizedRoute = routePath.replace(/\[(.+?)\]/g, ':$1');
  availableRoutes.add(normalizedRoute);
});

// Extract param names from a route path
function extractParamsFromRoute(routePath: string): string[] {
  const params: string[] = [];
  const paramRegex = /\[([^\]]+)\]/g;
  let match;
  
  while ((match = paramRegex.exec(routePath)) !== null) {
    params.push(match[1]);
  }
  
  return params;
}

// Combine all files to scan for links
const allFilesToScan = [...componentFiles, ...hooksFiles];

// Parse each file to extract links
allFilesToScan.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  
  try {
    const ast = babel.parseSync(code, {
      presets: ['@babel/preset-react', '@babel/preset-typescript'],
      plugins: ['@babel/plugin-syntax-jsx', '@babel/plugin-syntax-typescript'],
      filename: file,
      sourceType: 'module',
    });
    
    if (!ast) {
      console.error(`Failed to parse AST for ${file}`);
      return;
    }
    
    // Track route arrays/objects defined in the file
    const localRouteArrays = new Map<string, RouteObject[]>();
    
    traverse(ast, {
      // Find route array definitions (both const declarations and variable assignments)
      VariableDeclarator(path) {
        const node = path.node;
        if (t.isIdentifier(node.id) && t.isArrayExpression(node.init)) {
          extractRoutesFromArray(node.id.name, node.init, file, localRouteArrays);
        }
      },
      
      // Handle routes defined directly inside components (like your sidebar example)
      AssignmentExpression(path) {
        if (t.isIdentifier(path.node.left) && t.isArrayExpression(path.node.right)) {
          extractRoutesFromArray(path.node.left.name, path.node.right, file, localRouteArrays);
        }
      },
      
      // Extract static links from JSX elements
      JSXOpeningElement(nodePath) {
        const node = nodePath.node;
        
        // Check if it's a Link component or anchor tag
        if (
          (node.name.type === 'JSXIdentifier' && 
           (node.name.name === 'Link' || node.name.name === 'a'))
        ) {
          // Find href attribute
          const hrefAttr = node.attributes.find(
            (attr): attr is t.JSXAttribute => 
              attr.type === 'JSXAttribute' && 
              attr.name.type === 'JSXIdentifier' && 
              attr.name.name === 'href'
          );
          
          if (hrefAttr && hrefAttr.value) {
            if (t.isStringLiteral(hrefAttr.value)) {
              // Static string href
              const href = hrefAttr.value.value;
              
              if (href.startsWith('/')) {
                links.add({
                  path: href,
                  file: file,
                  line: node.loc?.start.line || 0
                });
              }
            } else if (t.isJSXExpressionContainer(hrefAttr.value)) {
              // For expressions like href={item.href}
              const expr = hrefAttr.value.expression;
              
              // Check for member expressions like item.href
              if (t.isMemberExpression(expr) && 
                  t.isIdentifier(expr.property) && 
                  expr.property.name === 'href') {
                
                // Look for common patterns in .map() iterations
                const jsxParent = findJSXParent(nodePath);
                if (jsxParent && t.isCallExpression(jsxParent.parent)) {
                  const call = jsxParent.parent;
                  
                  // Check if it's a .map() call on a known route array
                  if (t.isMemberExpression(call.callee) && 
                      t.isIdentifier(call.callee.property) && 
                      call.callee.property.name === 'map' &&
                      t.isIdentifier(call.callee.object)) {
                      
                    const arrayName = call.callee.object.name;
                    const routes = localRouteArrays.get(arrayName);
                    
                    if (routes) {
                      // We found a .map() on a known route array, so we can extract the links
                      console.log(`Found map over route array '${arrayName}' at line ${node.loc?.start.line || 0} in ${file}`);
                    }
                  }
                }
              } else {
                // Other dynamic link (template literals, etc.)
                console.log(`Dynamic link found in ${file} at line ${node.loc?.start.line || 0}`);
              }
            }
          }
        }
      },
      
      // Extract API fetch calls
      CallExpression(path) {
        // Look for fetch() calls
        if (t.isIdentifier(path.node.callee) && path.node.callee.name === 'fetch') {
          // Check if the first argument is a string literal or template literal
          const arg = path.node.arguments[0];
          if (t.isStringLiteral(arg) && arg.value.startsWith('/api/')) {
            links.add({
              path: arg.value,
              file: file,
              line: path.node.loc?.start.line || 0
            });
          } 
          // Handle template literals for API routes
          else if (t.isTemplateLiteral(arg)) {
            // Get the raw pieces of the template
            const quasis = arg.quasis.map(q => q.value.cooked || '');
            
            // If the template starts with '/api/' - handle it as a dynamic API route
            if (quasis.length > 0 && quasis[0] && quasis[0].startsWith('/api/')) {
              // Try to reconstruct the most likely API pattern
              let apiPattern = quasis[0];
              
              // For patterns like `/api/examples/${id}` we'll produce `/api/examples/:id`
              for (let i = 1; i < quasis.length; i++) {
                // Add a placeholder parameter between template parts
                apiPattern += `:param${i}${quasis[i] || ''}`;
              }
              
              // Log dynamic API call
              console.log(`Dynamic API fetch found: ${apiPattern} in ${file} at line ${path.node.loc?.start.line || 0}`);
              
              // Add as a special kind of link that's identifiable as dynamic
              links.add({
                path: apiPattern,
                file: file,
                line: path.node.loc?.start.line || 0
              });
            }
          }
        }
        
        // Look for axios calls
        if (t.isMemberExpression(path.node.callee) && 
            t.isIdentifier(path.node.callee.object) && 
            t.isIdentifier(path.node.callee.property) && 
            (path.node.callee.object.name === 'axios' || path.node.callee.object.name === 'api') && 
            ['get', 'post', 'put', 'delete', 'patch'].includes(path.node.callee.property.name)) {
          
          const arg = path.node.arguments[0];
          if (t.isStringLiteral(arg) && arg.value.startsWith('/api/')) {
            links.add({
              path: arg.value,
              file: file,
              line: path.node.loc?.start.line || 0
            });
          }
          // Handle template literals for API routes with axios
          else if (t.isTemplateLiteral(arg)) {
            // Get the raw pieces of the template
            const quasis = arg.quasis.map(q => q.value.cooked || '');
            
            // If the template starts with '/api/' - handle it as a dynamic API route
            if (quasis.length > 0 && quasis[0] && quasis[0].startsWith('/api/')) {
              // Try to reconstruct the most likely API pattern
              let apiPattern = quasis[0];
              
              // For patterns like `/api/examples/${id}` we'll produce `/api/examples/:id`
              for (let i = 1; i < quasis.length; i++) {
                // Add a placeholder parameter between template parts
                apiPattern += `:param${i}${quasis[i] || ''}`;
              }
              
              // Log dynamic API call
              console.log(`Dynamic API axios call found: ${apiPattern} in ${file} at line ${path.node.loc?.start.line || 0}`);
              
              // Add as a special kind of link that's identifiable as dynamic
              links.add({
                path: apiPattern,
                file: file,
                line: path.node.loc?.start.line || 0
              });
            }
          }
        }
      }
    });

    // Add all the routes found in arrays to our links
    // Convert Map entries to array for ES5 compatibility
    Array.from(localRouteArrays.entries()).forEach(([name, routes]) => {
      routes.forEach(route => {
        if (route.href && route.href.startsWith('/')) {
          links.add({
            path: route.href,
            file: file,
            line: route.line || 0
          });
        }
      });
    });
    
  } catch (error) {
    console.error(`Error parsing ${file}:`, error);
  }
});

// Helper function to extract routes from array expressions
function extractRoutesFromArray(
  name: string, 
  arrayExpr: t.ArrayExpression, 
  file: string, 
  localRouteArrays: Map<string, RouteObject[]>
): void {
  const routes: RouteObject[] = [];
  
  for (const element of arrayExpr.elements) {
    if (element && t.isObjectExpression(element)) {
      // Look for href property in object
      const hrefProp = element.properties.find(
        prop => t.isObjectProperty(prop) && 
               t.isIdentifier(prop.key) && 
               prop.key.name === 'href' &&
               t.isStringLiteral(prop.value)
      ) as t.ObjectProperty | undefined;
      
      if (hrefProp && t.isObjectProperty(hrefProp) && t.isStringLiteral(hrefProp.value)) {
        const href = hrefProp.value.value;
        
        routes.push({
          href,
          line: element.loc?.start.line
        });
      }
    }
  }
  
  if (routes.length > 0) {
    console.log(`Found route array '${name}' with ${routes.length} routes in ${file}`);
    localRouteArrays.set(name, routes);
  }
}

// Helper function to find the JSX parent element (for processing .map() calls)
function findJSXParent(path: NodePath<t.JSXOpeningElement>): NodePath | null {
  let current: NodePath | null = path;
  while (current && !t.isCallExpression(current.parent)) {
    current = current.parentPath;
  }
  return current;
}

// Exclude specific API paths from validation
const excludeApiPaths = [
  /^\/api\/examples\/?.*$/ // Exclude all /api/examples paths and subpaths
];

// Helper function to check if a link should be excluded
function shouldExcludeLink(linkPath: string): boolean {
  return excludeApiPaths.some(pattern => pattern.test(linkPath));
}

// Validate links against available routes
const invalidLinks: LinkReference[] = [];

links.forEach(link => {
  // Skip excluded paths
  if (shouldExcludeLink(link.path)) {
    console.log(`Skipping excluded API path: ${link.path}`);
    return;
  }
  
  let isValid = false;
  const linkPath = link.path;
  
  // Check exact match
  if (availableRoutes.has(linkPath)) {
    isValid = true;
  } else {
    // Check dynamic routes
    const routes = Array.from(availableRoutes);
    for (const route of routes) {
      if (route.includes(':') && routeMatches(route, linkPath)) {
        isValid = true;
        break;
      }
    }
  }
  
  if (!isValid) {
    invalidLinks.push(link);
  }
});

// Function to match dynamic routes
function routeMatches(routePattern: string, actualPath: string): boolean {
  const routeParts = routePattern.split('/').filter(Boolean);
  const pathParts = actualPath.split('/').filter(Boolean);
  
  if (routeParts.length !== pathParts.length) return false;
  
  for (let i = 0; i < routeParts.length; i++) {
    if (routeParts[i].startsWith(':')) continue; // Dynamic part, always matches
    if (routeParts[i] !== pathParts[i]) return false;
  }
  
  return true;
}

// Report results
console.log('\nStatic Path Analysis Results:');
console.log('===========================');
// Count API specific links
const apiLinks = Array.from(links)
  .filter(link => link.path.startsWith('/api/') && !shouldExcludeLink(link.path));

console.log(`Found ${links.size} internal links (${apiLinks.length} API endpoints to validate)`);
console.log(`Found ${availableRoutes.size} available routes`);
console.log(`Found ${apiRoutes.length} API routes`);

let hasErrors = false;

// Report general invalid links
if (invalidLinks.length > 0) {
  hasErrors = true;
  console.error('\nError: Invalid links detected');
  console.error('-----------------------------');
  console.error(`Found ${invalidLinks.length} invalid link${invalidLinks.length > 1 ? 's' : ''}`);
  console.error('\nInvalid Links:');
  invalidLinks.forEach(link => {
    console.error(`  . ${link.path}`);
    console.error(`    File: ${link.file}`);
    console.error(`    Line: ${link.line}`);
  });
  
  console.error('\nAvailable Routes:');
  Array.from(availableRoutes).sort().forEach(route => {
    console.error(` . ${route}`);
  });
}

if (hasErrors) {
  console.error('\nPlease fix these issues before proceeding.');
  process.exit(1); // Exit with error code
} else {
  console.log('\nAll links appear to be valid!');
  console.log('No issues found in static path analysis.');
}