
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
  const codeBlockRegex = /```(\w+)?\s*(?:\[([^\]]+)\])?\n([\s\S]*?)```/g;
  
  let match;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const language = match[1] || 'txt';
    const path = match[2];
    const content = match[3].trim();
    
    if (content) {
      codeBlocks.push({ language, content, path });
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
  const defaultName = 'code';

  const name = classMatch?.[1] || functionMatch?.[1] || packageMatch?.[1]?.split('.').pop() || defaultName;

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

  const extension = extensions[block.language.toLowerCase()] || '.txt';
  
  // Convert camelCase/PascalCase to kebab-case for the file name
  const fileName = name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();

  // For common web languages, use appropriate directories
  let directory = 'src/';
  if (['html', 'css', 'scss'].includes(block.language.toLowerCase())) {
    directory = 'src/assets/';
  } else if (['js', 'jsx', 'ts', 'tsx'].includes(block.language.toLowerCase())) {
    const isComponent = block.content.includes('export default') && 
                       (block.content.includes('function') || block.content.includes('class'));
    if (isComponent) {
      directory = 'src/components/';
    }
  }

  return `${directory}${fileName}${extension}`;
}
