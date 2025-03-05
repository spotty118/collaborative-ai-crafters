
import { Octokit } from '@octokit/rest';

interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export class GitHubService {
  private octokit: Octokit;
  private owner: string;
  private repo: string;

  constructor(config: GitHubConfig) {
    this.octokit = new Octokit({ auth: config.token });
    this.owner = config.owner;
    this.repo = config.repo;
    console.log(`GitHubService initialized for ${this.owner}/${this.repo}`);
  }

  /**
   * Parse a GitHub URL to extract owner and repo
   * @param url GitHub repository URL
   * @returns Object containing owner and repo names
   */
  static parseGitHubUrl(url: string): { owner: string; repo: string } {
    console.log(`Parsing GitHub URL: ${url}`);
    // Handle various GitHub URL formats
    const urlPatterns = [
      /github\.com\/([^/]+)\/([^/]+)(\/tree\/[^/]+)?/,  // Handles URLs with /tree/branch
      /github\.com\/([^/]+)\/([^/]+)/                   // Standard GitHub URLs
    ];
    
    for (const pattern of urlPatterns) {
      const matches = url.match(pattern);
      if (matches) {
        const owner = matches[1];
        // Remove .git extension if present
        const repo = matches[2]?.replace(/\.git$/, '');
        
        console.log(`Extracted owner: ${owner}, repo: ${repo}`);
        
        if (!owner || !repo) {
          throw new Error('Failed to extract owner or repository name from URL');
        }
        
        return { owner, repo };
      }
    }
    
    throw new Error('Invalid GitHub URL format');
  }

  /**
   * Create or update a file in the repository
   * @param path File path in the repository
   * @param content File content
   * @param message Commit message
   * @param branch Branch name (defaults to main)
   * @param attempts Number of retry attempts (used internally for recursion)
   */
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch = 'main',
    attempts = 0
  ): Promise<boolean> {
    // Prevent infinite recursion
    if (attempts > 3) {
      throw new Error('Too many retries when updating file, giving up');
    }
    
    // Normalize the file path for GitHub API
    const normalizedPath = path.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    
    console.log(`Creating/updating file ${normalizedPath} on branch ${branch} (attempt ${attempts + 1})`);
    try {
      // Get the current file (if it exists) to get the SHA
      let sha: string | undefined;
      try {
        console.log(`Checking if file ${normalizedPath} exists on branch ${branch}`);
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path: normalizedPath,
          ref: branch,
        });

        if (!Array.isArray(data)) {
          sha = data.sha;
          console.log(`Found existing file with SHA: ${sha}`);
        }
      } catch (error) {
        // File doesn't exist yet, which is fine
        console.log(`File ${normalizedPath} doesn't exist yet, will create new`);
        // Check if parent directories exist and create if needed
        await this.ensureDirectoryExists(normalizedPath, branch);
      }

      // Create or update the file
      console.log(`Sending request to create/update ${normalizedPath} on branch ${branch}`);
      
      // Use browser-compatible base64 encoding
      const base64Content = btoa(unescape(encodeURIComponent(content)));
      
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path: normalizedPath,
        message,
        content: base64Content,
        branch,
        ...(sha ? { sha } : {}),
      });
      
      console.log(`Successfully ${sha ? 'updated' : 'created'} file ${normalizedPath} on branch ${branch}`);
      console.log(`Commit URL: ${response.data.commit.html_url}`);
      return true;
    } catch (error) {
      console.error('Error creating/updating file:', error);
      
      // Check if the error is a 409 conflict (SHA mismatch)
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
        
        // @ts-ignore - Octokit error has response property
        if (error.response?.status === 409) {
          console.log('Detected SHA conflict. Retrying with fresh SHA...');
          // Wait a bit before retrying to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 1000));
          // Recursive call with incremented attempt counter
          return this.createOrUpdateFile(path, content, message, branch, attempts + 1);
        }
        
        if ('response' in error) {
          // @ts-ignore
          console.error(`GitHub API response: ${JSON.stringify(error.response?.data)}`);
        }
      }
      throw new Error(`Failed to create/update file in repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure directory exists by creating a .gitkeep file if needed
   * @param filePath Path to file that will be created
   * @param branch Branch name
   */
  private async ensureDirectoryExists(filePath: string, branch: string): Promise<void> {
    const dirPath = filePath.split('/').slice(0, -1).join('/');
    
    if (!dirPath) return; // No directory to create
    
    try {
      // Check if directory exists
      await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: dirPath,
        ref: branch,
      });
      console.log(`Directory ${dirPath} already exists`);
    } catch (error) {
      console.log(`Directory ${dirPath} doesn't exist, creating it with a .gitkeep file`);
      try {
        // Create directory by adding a .gitkeep file
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.owner,
          repo: this.repo,
          path: `${dirPath}/.gitkeep`,
          message: `chore: Create directory ${dirPath}`,
          content: btoa(''), // empty file
          branch,
        });
        console.log(`Successfully created directory ${dirPath}`);
      } catch (dirError) {
        console.error(`Failed to create directory ${dirPath}:`, dirError);
        // Continue anyway, it might work if parent directory exists
      }
    }
  }

  /**
   * Get the contents of a file from the repository
   * @param path File path in the repository
   * @param ref Branch or commit SHA
   * @returns File content as string
   */
  async getFileContent(path: string, ref = 'main'): Promise<string> {
    // Normalize the file path for GitHub API
    const normalizedPath = path.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    
    console.log(`Getting file content for ${normalizedPath} from branch ${ref}`);
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: normalizedPath,
        ref,
      });

      if (Array.isArray(data)) {
        throw new Error('Path points to a directory, not a file');
      }

      if ('content' in data && typeof data.content === 'string') {
        // Use browser-compatible base64 decoding
        const content = decodeURIComponent(escape(atob(data.content)));
        console.log(`Successfully retrieved file content for ${normalizedPath}`);
        return content;
      } else {
        throw new Error('Invalid file content format received from GitHub API');
      }
    } catch (error) {
      console.error(`Error getting file content for ${normalizedPath}:`, error);
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
        if ('response' in error) {
          // @ts-ignore
          console.error(`GitHub API response: ${JSON.stringify(error.response?.data)}`);
        }
      }
      throw error instanceof Error ? error : new Error('Failed to get file content from repository');
    }
  }

  /**
   * Delete a file from the repository
   * @param path File path in the repository
   * @param message Commit message
   * @param branch Branch name (defaults to main)
   */
  async deleteFile(
    path: string,
    message: string,
    branch = 'main'
  ): Promise<void> {
    // Normalize the file path for GitHub API
    const normalizedPath = path.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    
    console.log(`Deleting file ${normalizedPath} on branch ${branch}`);
    try {
      // Get the current file's SHA
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: normalizedPath,
        ref: branch,
      });

      if (Array.isArray(data)) {
        throw new Error('Path points to a directory, not a file');
      }

      // Delete the file
      await this.octokit.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path: normalizedPath,
        message,
        sha: data.sha,
        branch,
      });
      console.log(`Successfully deleted file ${normalizedPath} on branch ${branch}`);
    } catch (error) {
      console.error(`Error deleting file ${normalizedPath}:`, error);
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
        if ('response' in error) {
          // @ts-ignore
          console.error(`GitHub API response: ${JSON.stringify(error.response?.data)}`);
        }
      }
      throw new Error('Failed to delete file from repository');
    }
  }

  /**
   * List files in a directory
   * @param path Directory path in the repository
   * @param branch Branch name (defaults to main)
   * @returns Array of file objects
   */
  async listFiles(path: string = '', branch = 'main'): Promise<{name: string, path: string, type: string}[]> {
    // Normalize the directory path for GitHub API
    const normalizedPath = path.replace(/^[/\\]+/, '').replace(/\\/g, '/');
    
    console.log(`Listing files in ${normalizedPath || 'root'} on branch ${branch}`);
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: normalizedPath,
        ref: branch,
      });

      if (!Array.isArray(data)) {
        throw new Error('Path points to a file, not a directory');
      }

      return data.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type || 'file'
      }));
    } catch (error) {
      console.error(`Error listing files in ${normalizedPath}:`, error);
      throw error instanceof Error ? error : new Error('Failed to list files from repository');
    }
  }

  /**
   * Get repository branch information
   * @returns Array of branch objects
   */
  async listBranches(): Promise<string[]> {
    console.log(`Listing branches for ${this.owner}/${this.repo}`);
    try {
      const { data } = await this.octokit.repos.listBranches({
        owner: this.owner,
        repo: this.repo,
      });

      const branches = data.map(branch => branch.name);
      console.log(`Found branches: ${branches.join(', ')}`);
      return branches;
    } catch (error) {
      console.error('Error listing branches:', error);
      throw error instanceof Error ? error : new Error('Failed to list branches from repository');
    }
  }

  /**
   * Create a new branch based on another branch
   * @param newBranch New branch name
   * @param baseBranch Base branch name (defaults to main)
   */
  async createBranch(newBranch: string, baseBranch = 'main'): Promise<void> {
    console.log(`Creating branch ${newBranch} from ${baseBranch}`);
    try {
      // Get the SHA of the latest commit on the base branch
      const { data: refData } = await this.octokit.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`,
      });

      // Create the new branch
      await this.octokit.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${newBranch}`,
        sha: refData.object.sha,
      });
      
      console.log(`Successfully created branch ${newBranch}`);
    } catch (error) {
      console.error(`Error creating branch ${newBranch}:`, error);
      throw error instanceof Error ? error : new Error('Failed to create branch');
    }
  }

  /**
   * Test the connection to GitHub
   * @returns Boolean indicating success
   */
  async testConnection(): Promise<boolean> {
    console.log(`Testing connection to ${this.owner}/${this.repo}`);
    try {
      await this.octokit.repos.get({
        owner: this.owner,
        repo: this.repo,
      });
      console.log('Connection test successful');
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
}

/**
 * Create a GitHub service instance from a repository URL
 * @param url GitHub repository URL
 * @param token GitHub personal access token
 * @returns GitHubService instance
 */
export function createGitHubService(url: string, token: string): GitHubService {
  console.log(`Creating GitHub service for ${url}`);
  const { owner, repo } = GitHubService.parseGitHubUrl(url);
  return new GitHubService({ token, owner, repo });
}
