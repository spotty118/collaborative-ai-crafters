
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
   */
  async createOrUpdateFile(
    path: string,
    content: string,
    message: string,
    branch = 'main'
  ): Promise<void> {
    console.log(`Creating/updating file ${path} on branch ${branch}`);
    try {
      // Get the current file (if it exists) to get the SHA
      let sha: string | undefined;
      try {
        console.log(`Checking if file ${path} exists on branch ${branch}`);
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: branch,
        });

        if (!Array.isArray(data)) {
          sha = data.sha;
          console.log(`Found existing file with SHA: ${sha}`);
        }
      } catch (error) {
        // File doesn't exist yet, which is fine
        console.log(`File ${path} doesn't exist yet, will create new`);
      }

      // Create or update the file
      console.log(`Sending request to create/update ${path} on branch ${branch}`);
      const response = await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: Buffer.from(content).toString('base64'),
        branch,
        ...(sha ? { sha } : {}),
      });
      
      console.log(`Successfully ${sha ? 'updated' : 'created'} file ${path} on branch ${branch}`);
      console.log(`Commit URL: ${response.data.commit.html_url}`);
      return;
    } catch (error) {
      console.error('Error creating/updating file:', error);
      if (error instanceof Error) {
        console.error(`Error details: ${error.message}`);
        if ('response' in error) {
          // @ts-ignore
          console.error(`GitHub API response: ${JSON.stringify(error.response?.data)}`);
        }
      }
      throw new Error(`Failed to create/update file in repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the contents of a file from the repository
   * @param path File path in the repository
   * @param ref Branch or commit SHA
   * @returns File content as string
   */
  async getFileContent(path: string, ref = 'main'): Promise<string> {
    console.log(`Getting file content for ${path} from branch ${ref}`);
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref,
      });

      if (Array.isArray(data)) {
        throw new Error('Path points to a directory, not a file');
      }

      if ('content' in data && typeof data.content === 'string') {
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        console.log(`Successfully retrieved file content for ${path}`);
        return content;
      } else {
        throw new Error('Invalid file content format received from GitHub API');
      }
    } catch (error) {
      console.error(`Error getting file content for ${path}:`, error);
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
    console.log(`Deleting file ${path} on branch ${branch}`);
    try {
      // Get the current file's SHA
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
        ref: branch,
      });

      if (Array.isArray(data)) {
        throw new Error('Path points to a directory, not a file');
      }

      // Delete the file
      await this.octokit.repos.deleteFile({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        sha: data.sha,
        branch,
      });
      console.log(`Successfully deleted file ${path} on branch ${branch}`);
    } catch (error) {
      console.error(`Error deleting file ${path}:`, error);
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
    console.log(`Listing files in ${path || 'root'} on branch ${branch}`);
    try {
      const { data } = await this.octokit.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path,
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
      console.error(`Error listing files in ${path}:`, error);
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
