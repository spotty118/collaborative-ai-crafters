
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
  }

  /**
   * Parse a GitHub URL to extract owner and repo
   * @param url GitHub repository URL
   * @returns Object containing owner and repo names
   */
  static parseGitHubUrl(url: string): { owner: string; repo: string } {
    const matches = url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!matches) {
      throw new Error('Invalid GitHub URL format');
    }
    return {
      owner: matches[1],
      repo: matches[2],
    };
  }

  // Browser-compatible base64 encoding
  private encodeToBase64(text: string): string {
    return btoa(unescape(encodeURIComponent(text)));
  }
  
  // Browser-compatible base64 decoding
  private decodeFromBase64(encoded: string): string {
    return decodeURIComponent(escape(atob(encoded)));
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
    try {
      console.log(`Attempting to create/update file: ${path}`);
      // Get the current file (if it exists) to get the SHA
      let sha: string | undefined;
      try {
        const { data } = await this.octokit.repos.getContent({
          owner: this.owner,
          repo: this.repo,
          path,
          ref: branch,
        });

        if (!Array.isArray(data)) {
          sha = data.sha;
        }
      } catch (error) {
        // File doesn't exist yet, which is fine
        console.log(`File ${path} doesn't exist yet, creating new file`);
      }

      // Create or update the file with browser-compatible base64 encoding
      const base64Content = this.encodeToBase64(content);
      
      await this.octokit.repos.createOrUpdateFileContents({
        owner: this.owner,
        repo: this.repo,
        path,
        message,
        content: base64Content,
        branch,
        ...(sha ? { sha } : {}),
      });
      
      console.log(`Successfully created/updated file: ${path}`);
    } catch (error) {
      console.error('Error creating/updating file:', error);
      throw new Error('Failed to create/update file in repository');
    }
  }

  /**
   * Get the contents of a file from the repository
   * @param path File path in the repository
   * @param ref Branch or commit SHA
   * @returns File content as string
   */
  async getFileContent(path: string, ref = 'main'): Promise<string> {
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
        return this.decodeFromBase64(data.content);
      } else {
        throw new Error('Invalid file content format received from GitHub API');
      }
    } catch (error) {
      console.error('Error getting file content:', error);
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
    } catch (error) {
      console.error('Error deleting file:', error);
      throw new Error('Failed to delete file from repository');
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
  const { owner, repo } = GitHubService.parseGitHubUrl(url);
  return new GitHubService({ token, owner, repo });
}
