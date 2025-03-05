
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
  // Enhanced regex to better capture code blocks with path information
  // This handles both ```language [path] and ```language syntax
  const codeBlockRegex = /```(\w+)?\s*(?:\[([^\]]+)\])?\n([\s\S]*?)```/g;
  
  // Also try to capture blocks that might have the path on the same line as the language
  const altCodeBlockRegex = /```(\w+)?\s+\[([^\]]+)\]\s*\n([\s\S]*?)```/g;
  
  console.log("Parsing text for code blocks...");
  
  let match;
  // Try the primary regex first
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'txt';
    const path = match[2];
    const content = match[3].trim();
    
    console.log(`Found code block - Language: ${language}, Path: ${path || 'not specified'}`);
    
    if (content) {
      codeBlocks.push({ language, content, path });
    }
  }
  
  // If we didn't find any matches, try the alternative regex
  if (codeBlocks.length === 0) {
    while ((match = altCodeBlockRegex.exec(text)) !== null) {
      const language = match[1] || 'txt';
      const path = match[2];
      const content = match[3].trim();
      
      console.log(`Found code block (alt format) - Language: ${language}, Path: ${path || 'not specified'}`);
      
      if (content) {
        codeBlocks.push({ language, content, path });
      }
    }
  }
  
  // If we still didn't find any with our regexes, let's try a more permissive approach
  if (codeBlocks.length === 0) {
    // Simple fallback regex that just looks for code blocks without paths
    const fallbackRegex = /```(\w+)?\n([\s\S]*?)```/g;
    
    while ((match = fallbackRegex.exec(text)) !== null) {
      const language = match[1] || 'txt';
      const content = match[2].trim();
      
      console.log(`Found code block (fallback) - Language: ${language}`);
      
      if (content) {
        codeBlocks.push({ language, content });
      }
    }
  }
  
  console.log(`Total code blocks found: ${codeBlocks.length}`);
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
  }

  return `${directory}${fileName}${extension}`;
}
