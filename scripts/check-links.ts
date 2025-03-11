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

interface DynamicRouteInfo {
  routePath: string;           // Full route path with [param] syntax
  filePath: string;            // Actual file path
  params: string[];            // List of parameters in the route
  hasStaticParams: boolean;    // Whether generateStaticParams exists
  staticParamValues: Map<string, string[]>; // Parameter values from generateStaticParams
}

// Store found links
const links: Set<LinkReference> = new Set();
// Store available routes
const availableRoutes: Set<string> = new Set();
// Store dynamic route information
const dynamicRoutes: DynamicRouteInfo[] = [];

// Find all TSX files in the project
const componentFiles: string[] = glob.sync('{./app,./components}/**/*.tsx');
const pageFiles: string[] = glob.sync('./app/**/{page,layout}.tsx');

// Extract dynamic route information
pageFiles.forEach(file => {
  let routePath = file
    .replace('./app', '')
    .replace(/\/page\.tsx$/, '')
    .replace(/\/layout\.tsx$/, '')
    .replace(/\/\(.*?\)\//g, '/'); // Handle route groups
  
  // If this is a dynamic route with [param] segments
  if (routePath.includes('[')) {
    const params = extractParamsFromRoute(routePath);
    
    // Initialize the dynamic route info
    const routeInfo: DynamicRouteInfo = {
      routePath,
      filePath: file,
      params,
      hasStaticParams: false,
      staticParamValues: new Map<string, string[]>()
    };
    
    // Check if the file contains generateStaticParams
    checkForStaticParams(file, routeInfo);
    
    dynamicRoutes.push(routeInfo);
  }
  
  // Convert for normal route matching (as in the original code)
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

// Function to traverse AST and handle scoping correctly
function traverseBody(node: t.Node, visitor: any): void {
  const newAST = t.program([t.expressionStatement(t.stringLiteral('placeholder'))]);
  babel.transformFromAstSync(newAST, undefined, {
    plugins: [
      {
        visitor: {
          Program(path: babel.NodePath<t.Program>) {
            // Replace the program body with our node
            path.node.body = [t.expressionStatement(t.assignmentExpression(
              '=',
              t.identifier('__dummy'),
              t.objectExpression([])
            ))];
            
            // Create a dummy path for our node
            const dummyPath = path.get('body.0.expression.right') as babel.NodePath;
            dummyPath.replaceWith(node);
            
            // Now traverse with our visitor
            dummyPath.traverse(visitor);
          }
        }
      }
    ]
  });
}

// Check if a file has generateStaticParams and extract parameter values
function checkForStaticParams(filePath: string, routeInfo: DynamicRouteInfo): void {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    
    const ast = babel.parseSync(code, {
      presets: ['@babel/preset-react', '@babel/preset-typescript'],
      plugins: ['@babel/plugin-syntax-jsx', '@babel/plugin-syntax-typescript'],
      filename: filePath,
      sourceType: 'module',
    });
    
    if (!ast) {
      console.error(`Failed to parse AST for ${filePath}`);
      return;
    }
    
    // Use babel's traverse directly
    babel.traverse(ast, {
      ExportNamedDeclaration(path) {
        const declaration = path.node.declaration;
        
        // Check if this is the generateStaticParams function
        if (declaration && 
            t.isFunctionDeclaration(declaration) && 
            declaration.id && 
            declaration.id.name === 'generateStaticParams') {
          
          routeInfo.hasStaticParams = true;
          
          // Extract from function body
          if (declaration.body && t.isBlockStatement(declaration.body)) {
            babel.traverse(declaration.body, {
              ReturnStatement(returnPath) {
                const argument = returnPath.node.argument;
                
                // Handle array literals
                if (t.isArrayExpression(argument)) {
                  extractParamsFromArrayExpression(argument, routeInfo);
                }
              }
            }, path.scope);
          }
        }
      },
      
      // Handle arrow function export variant
      VariableDeclaration(path) {
        const declarations = path.node.declarations;
        
        for (const declaration of declarations) {
          if (t.isIdentifier(declaration.id) && 
              declaration.id.name === 'generateStaticParams' &&
              path.parent && 
              t.isExportNamedDeclaration(path.parent)) {
              
            routeInfo.hasStaticParams = true;
            
            // For arrow function expressions
            if (declaration.init && t.isArrowFunctionExpression(declaration.init)) {
              // Direct return with array
              if (t.isArrayExpression(declaration.init.body)) {
                extractParamsFromArrayExpression(declaration.init.body, routeInfo);
              } 
              // Block body with return statement
              else if (t.isBlockStatement(declaration.init.body)) {
                babel.traverse(declaration.init.body, {
                  ReturnStatement(returnPath) {
                    if (t.isArrayExpression(returnPath.node.argument)) {
                      extractParamsFromArrayExpression(returnPath.node.argument, routeInfo);
                    }
                  }
                }, path.scope);
              }
            }
            
            // For function expressions
            if (declaration.init && t.isFunctionExpression(declaration.init) && 
                t.isBlockStatement(declaration.init.body)) {
              babel.traverse(declaration.init.body, {
                ReturnStatement(returnPath) {
                  if (t.isArrayExpression(returnPath.node.argument)) {
                    extractParamsFromArrayExpression(returnPath.node.argument, routeInfo);
                  }
                }
              }, path.scope);
            }
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error analyzing ${filePath} for generateStaticParams:`, error);
  }
}

// These functions have been incorporated into checkForStaticParams
// for better type safety and to avoid the traverse issues

// Extract parameters from an array expression
function extractParamsFromArrayExpression(
  arrayExpr: t.ArrayExpression, 
  routeInfo: DynamicRouteInfo
): void {
  for (const element of arrayExpr.elements) {
    if (element && t.isObjectExpression(element)) {
      const params = routeInfo.params;
      
      // For each parameter in the route, try to extract its value
      for (const param of params) {
        for (const property of element.properties) {
          if (t.isObjectProperty(property) && 
              t.isIdentifier(property.key) && 
              property.key.name === param) {
            
            if (t.isStringLiteral(property.value)) {
              // Initialize the param array if it doesn't exist
              if (!routeInfo.staticParamValues.has(param)) {
                routeInfo.staticParamValues.set(param, []);
              }
              
              // Add the param value
              routeInfo.staticParamValues.get(param)?.push(property.value.value);
            }
          }
        }
      }
    }
  }
}

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

// Check dynamic routes for missing generateStaticParams
const missingStaticParams: DynamicRouteInfo[] = dynamicRoutes.filter(
  route => !route.hasStaticParams
);

// Check links to dynamic routes to ensure params are included in generateStaticParams
interface MissingParamError {
  link: LinkReference;
  route: DynamicRouteInfo;
  missingParams: { param: string; value: string; }[];
}

const missingParamErrors: MissingParamError[] = [];

links.forEach(link => {
  const linkPath = link.path;
  
  // Check each dynamic route
  for (const route of dynamicRoutes) {
    // Skip routes without generateStaticParams (they'll be reported separately)
    if (!route.hasStaticParams) continue;
    
    // Check if this link might be for this dynamic route
    if (isDynamicRouteMatch(route.routePath, linkPath)) {
      const missingParams = checkParamsInLink(route, linkPath);
      
      if (missingParams.length > 0) {
        missingParamErrors.push({
          link,
          route,
          missingParams
        });
      }
    }
  }
});

// Check if a link matches a dynamic route pattern
function isDynamicRouteMatch(routePath: string, linkPath: string): boolean {
  // Replace dynamic segments with regex pattern
  const pattern = routePath
    .replace(/\[([^\]]+)\]/g, '([^/]+)')  // Replace [param] with capture group
    .replace(/\//g, '\\/');               // Escape slashes
  
  const regex = new RegExp(`^${pattern}$`);
  return regex.test(linkPath);
}

// Check if the parameters in a link are included in generateStaticParams
function checkParamsInLink(route: DynamicRouteInfo, linkPath: string): { param: string; value: string; }[] {
  const routeParts = route.routePath.split('/').filter(Boolean);
  const linkParts = linkPath.split('/').filter(Boolean);
  
  if (routeParts.length !== linkParts.length) return [];
  
  const missingParams: { param: string; value: string; }[] = [];
  
  for (let i = 0; i < routeParts.length; i++) {
    const routePart = routeParts[i];
    const linkPart = linkParts[i];
    
    // Check if this is a dynamic segment
    const paramMatch = routePart.match(/\[([^\]]+)\]/);
    if (paramMatch) {
      const paramName = paramMatch[1];
      const paramValues = route.staticParamValues.get(paramName) || [];
      
      // If the param value in the link is not included in generateStaticParams
      if (!paramValues.includes(linkPart)) {
        missingParams.push({
          param: paramName,
          value: linkPart
        });
      }
    }
  }
  
  return missingParams;
}

// Report results
console.log('\nStatic Path Analysis Results:');
console.log('===========================');
console.log(`Found ${links.size} internal links`);
console.log(`Found ${availableRoutes.size} available routes`);
console.log(`Found ${dynamicRoutes.length} dynamic routes`);

let hasErrors = false;

// Report dynamic routes without generateStaticParams
if (missingStaticParams.length > 0) {
  hasErrors = true;
  console.error('\nError: Dynamic routes missing generateStaticParams function');
  console.error('----------------------------------------------------------');
  console.error(`Found ${missingStaticParams.length} dynamic route${missingStaticParams.length > 1 ? 's' : ''} missing generateStaticParams`);
  
  missingStaticParams.forEach(route => {
    console.error(`\n  Dynamic Route: ${route.routePath}`);
    console.error(`  File: ${route.filePath}`);
    console.error(`  Required Params: [${route.params.join(', ')}]`);
    console.error(`  Error: Missing generateStaticParams() export`);
  });
}

// Report links with params not included in generateStaticParams
if (missingParamErrors.length > 0) {
  hasErrors = true;
  console.error('\nError: Links with params not included in generateStaticParams');
  console.error('-----------------------------------------------------------');
  console.error(`Found ${missingParamErrors.length} link${missingParamErrors.length > 1 ? 's' : ''} with params not included in generateStaticParams`);
  
  missingParamErrors.forEach(error => {
    console.error(`\n  Link: ${error.link.path}`);
    console.error(`  File: ${error.link.file}`);
    console.error(`  Line: ${error.link.line}`);
    console.error(`  Target Route: ${error.route.routePath}`);
    console.error(`  Missing Params in generateStaticParams:`);
    
    error.missingParams.forEach(missing => {
      console.error(`    - ${missing.param}: "${missing.value}"`);
    });
    
    // Show available values for each param from generateStaticParams
    console.error(`  Available values in generateStaticParams:`);
    error.route.params.forEach(param => {
      const values = error.route.staticParamValues.get(param) || [];
      console.error(`    - ${param}: [${values.join(', ')}]`);
    });
  });
}

// Report general invalid links (original functionality)
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
  console.log('All dynamic routes have generateStaticParams with appropriate parameters.');
  console.log('No issues found in static path analysis.');
}