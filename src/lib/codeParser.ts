
interface CodeBlock {
  language: string;
  content: string;
  path?: string;
}

/**
 * Parse code blocks from markdown-formatted text
 * @param text Text containing markdown code blocks
 * @returns Array of code blocks with language and content
 */
export function parseCodeBlocks(text: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];
  
  // Enhanced regex patterns to better capture code blocks with path information
  const patterns = [
    // ```language [path]
    /```(\w+)?\s*\[([^\]]+)\]\s*\n([\s\S]*?)```/g,
    
    // ```language
    // path: path/to/file.ext
    /```(\w+)?\s*\n(?:path|filepath|file path|filename):\s*([\w\/\.\-\_]+)?\s*\n([\s\S]*?)```/gi,
    
    // Just ```language without path (fallback)
    /```(\w+)?\s*\n([\s\S]*?)```/g
  ];
  
  console.log("Parsing text for code blocks...");
  
  // Try each pattern in order of specificity
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Different handling based on the pattern matched
      if (pattern.toString().includes("path|filepath")) {
        // Second pattern: ```language\npath: path/to/file.ext
        const language = match[1] || 'txt';
        const path = match[2];
        const content = match[3].trim();
        
        if (content) {
          console.log(`Found code block - Language: ${language}, Path from label: ${path || 'not specified'}`);
          codeBlocks.push({ language, content, path });
        }
      } else if (pattern.toString().includes("\\[([^\\]]+)\\]")) {
        // First pattern: ```language [path]
        const language = match[1] || 'txt';
        const path = match[2];
        const content = match[3].trim();
        
        if (content) {
          console.log(`Found code block - Language: ${language}, Path from brackets: ${path || 'not specified'}`);
          codeBlocks.push({ language, content, path });
        }
      } else {
        // Third pattern: simple ```language without path
        const language = match[1] || 'txt';
        const content = match[2].trim();
        
        if (content) {
          console.log(`Found code block - Language: ${language}, No path specified`);
          codeBlocks.push({ language, content });
        }
      }
    }
    
    // If we found blocks with this pattern, stop trying other patterns
    if (codeBlocks.length > 0) {
      break;
    }
  }
  
  console.log(`Total code blocks found: ${codeBlocks.length}`);
  
  // Infer paths for blocks without paths
  for (let i = 0; i < codeBlocks.length; i++) {
    if (!codeBlocks[i].path) {
      codeBlocks[i].path = inferFilePath(codeBlocks[i]);
      console.log(`Inferred path for block ${i+1}: ${codeBlocks[i].path}`);
    }
  }
  
  return codeBlocks;
}

/**
 * Infer file path for a code block based on its language and content
 * @param block Code block with language and content
 * @returns Suggested file path
 */
export function inferFilePath(block: CodeBlock): string {
  if (block.path) {
    return block.path;
  }

  // Try to find package or class name from content
  const packageMatch = block.content.match(/package\s+([.\w]+)/);
  const classMatch = block.content.match(/(?:class|interface)\s+(\w+)/);
  const functionMatch = block.content.match(/function\s+(\w+)/);
  const reactComponentMatch = block.content.match(/(?:const|function)\s+(\w+)\s*(?:=|:)\s*(?:React\.)?(?:FC|FunctionComponent)/);
  const defaultExportMatch = block.content.match(/export\s+default\s+(?:class|function|const)?\s*(\w+)/);
  
  const extractedName = reactComponentMatch?.[1] || 
                         defaultExportMatch?.[1] || 
                         classMatch?.[1] || 
                         functionMatch?.[1] || 
                         packageMatch?.[1]?.split('.').pop();
  
  const defaultName = extractedName || 'code';

  const extensions: { [key: string]: string } = {
    typescript: '.ts',
    ts: '.ts',
    javascript: '.js',
    js: '.js',
    jsx: '.jsx',
    tsx: '.tsx',
    python: '.py',
    py: '.py',
    java: '.java',
    ruby: '.rb',
    go: '.go',
    rust: '.rs',
    cpp: '.cpp',
    'c++': '.cpp',
    c: '.c',
    php: '.php',
    swift: '.swift',
    kotlin: '.kt',
    scala: '.scala',
    html: '.html',
    css: '.css',
    scss: '.scss',
    sql: '.sql',
    yaml: '.yaml',
    yml: '.yml',
    json: '.json',
    xml: '.xml',
    md: '.md',
    txt: '.txt'
  };

  // For TypeScript/JavaScript, determine if we need .tsx/.jsx extension based on content
  let extension = extensions[block.language.toLowerCase()] || '.txt';
  
  if (['ts', 'typescript'].includes(block.language.toLowerCase()) && 
      (block.content.includes('React') || block.content.includes('JSX') || block.content.includes('</'))) {
    extension = '.tsx';
  } else if (['js', 'javascript'].includes(block.language.toLowerCase()) && 
             (block.content.includes('React') || block.content.includes('JSX') || block.content.includes('</'))) {
    extension = '.jsx';
  }
  
  // Convert camelCase/PascalCase to kebab-case for the file name
  const fileName = defaultName
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  // For common web languages, use appropriate directories
  let directory = 'src/';
  if (['html', 'css', 'scss'].includes(block.language.toLowerCase())) {
    directory = 'src/assets/';
  } else if (['js', 'jsx', 'ts', 'tsx'].includes(block.language.toLowerCase())) {
    const isReactComponent = 
      block.content.includes('React') || 
      block.content.includes('JSX') || 
      block.content.includes('</') || 
      block.content.includes('function Component') ||
      block.content.includes('className=');
      
    const isComponent = 
      (block.content.includes('export default') && 
       (block.content.includes('function') || block.content.includes('class') || block.content.includes('const'))) ||
      isReactComponent;
      
    if (isComponent) {
      directory = 'src/components/';
    } else if (block.content.includes('import') && block.content.includes('export')) {
      directory = 'src/lib/';
    } else if (block.content.includes('test(') || block.content.includes('describe(')) {
      directory = 'src/tests/';
    }
  } else if (['py', 'python'].includes(block.language.toLowerCase())) {
    // For Python, handle common module patterns
    if (block.content.includes('class') && block.content.includes('model')) {
      directory = 'models/';
    } else if (block.content.includes('def') && (block.content.includes('route') || block.content.includes('blueprint'))) {
      directory = 'routes/';
    } else if (block.content.includes('def') && (block.content.includes('service') || block.content.includes('utility'))) {
      directory = 'services/';
    }
  }

  return `${directory}${fileName}${extension}`;
}
