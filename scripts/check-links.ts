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

// Store found links
const links: Set<LinkReference> = new Set();
// Store available routes
const availableRoutes: Set<string> = new Set();

// Find all TSX files in the project
const componentFiles: string[] = glob.sync('./app/**/*.tsx');
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
    
    traverse(ast!, {
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
              // For expressions like href={`/path/${id}`}
              console.log(`Dynamic link found in ${file} at line ${node.loc?.start.line || 0}`);
            }
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error parsing ${file}:`, error);
  }
});

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
    for (const route of availableRoutes) {
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
  console.error('\n❌ Error: Invalid links detected');
  console.error('-----------------------------');
  console.error(`Found ${invalidLinks.length} invalid link${invalidLinks.length > 1 ? 's' : ''}`);
  console.error('\nInvalid Links:');
  invalidLinks.forEach(link => {
    console.error(`  • ${link.path}`);
    console.error(`    File: ${link.file}`);
    console.error(`    Line: ${link.line}`);
  });
  
  console.error('\nAvailable Routes:');
  Array.from(availableRoutes).sort().forEach(route => {
    console.error(`  • ${route}`);
  });
  
  console.error('\nPlease fix these invalid links before proceeding.');
  process.exit(1); // Exit with error code
} else {
  console.log('\n✅ All links appear to be valid!');
  console.log('No issues found in static path analysis.');
}