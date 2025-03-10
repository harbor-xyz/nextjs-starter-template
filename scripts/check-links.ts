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

// Store found links
const links: Set<LinkReference> = new Set();
// Store available routes
const availableRoutes: Set<string> = new Set();

// Find all TSX files in the project
const componentFiles: string[] = glob.sync('{./app,./components}/**/*.tsx');
const pageFiles: string[] = glob.sync('./app/**/{page,layout}.tsx');

// Collect available routes
pageFiles.forEach(file => {
  let route = file
    .replace('./app', '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/layout\.tsx$/, '')
    .replace(/\/\(.*?\)\//g, '/') // Handle route groups
    .replace(/\[(.+?)\]/g, ':$1'); // Convert [param] to :param for matching
    
  if (route === '') route = '/';
  availableRoutes.add(route);
});

console.log('Available routes:', Array.from(availableRoutes));

// Parse each component file to extract links
componentFiles.forEach(file => {
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

// Validate links against available routes
const invalidLinks: LinkReference[] = [];

links.forEach(link => {
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
console.log(`Found ${links.size} internal links`);
console.log(`Found ${availableRoutes.size} available routes`);

if (invalidLinks.length > 0) {
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
  
  console.error('\nPlease fix these invalid links before proceeding.');
  process.exit(1); // Exit with error code
} else {
  console.log('\nAll links appear to be valid!');
  console.log('No issues found in static path analysis.');
}