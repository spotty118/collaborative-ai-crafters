
import { toast } from "sonner";

// GitHub API configuration
const GITHUB_API_URL = "https://api.github.com";

// Types for GitHub integration
export interface GithubAuthResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GithubUser {
  login: string;
  id: number;
  name: string;
  avatar_url: string;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  private: boolean;
  default_branch: string;
}

// Local storage keys
const GITHUB_TOKEN_KEY = "github_access_token";

// Helper function to get the stored token
export const getGithubToken = (): string | null => {
  return localStorage.getItem(GITHUB_TOKEN_KEY);
};

// Helper function to store the token
export const setGithubToken = (token: string): void => {
  localStorage.setItem(GITHUB_TOKEN_KEY, token);
};

// Helper function to clear the token
export const clearGithubToken = (): void => {
  localStorage.removeItem(GITHUB_TOKEN_KEY);
};

// Initiate GitHub OAuth flow
export const initiateGithubAuth = (clientId: string): void => {
  if (!clientId) {
    toast.error("GitHub client ID is required");
    return;
  }

  // Use current origin as redirect URI to match GitHub OAuth app settings
  const redirectUri = window.location.origin; 
  const scope = "repo";
  
  console.log("Initiating GitHub OAuth with redirect URI:", redirectUri);
  
  // Add state parameter for security
  const state = Math.random().toString(36).substring(2, 15);
  localStorage.setItem('github_oauth_state', state);
  
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}`;
  
  window.location.href = authUrl;
};

// Create a proxy server for GitHub authentication
// In a real-world scenario this would be a server endpoint
async function proxyGithubAuth(code: string): Promise<string> {
  // This is a mock implementation for development purposes
  // In a real app, you would use a server endpoint to exchange code for token
  
  // For now, we'll simulate a successful auth for development/testing
  return 'github_' + Math.random().toString(36).substring(2, 15);
}

// Handle the OAuth callback and exchange code for token
export const handleGithubCallback = async (code: string, state?: string): Promise<boolean> => {
  try {
    // Verify state if provided
    const savedState = localStorage.getItem('github_oauth_state');
    if (state && savedState && state !== savedState) {
      throw new Error("OAuth state mismatch, possible CSRF attack");
    }
    
    // Clear the state after use
    localStorage.removeItem('github_oauth_state');
    
    console.log("Handling GitHub callback with code:", code.substring(0, 5) + "...");
    
    // For development purposes: exchange code for token via our mock proxy
    // In production, this would call a real server endpoint
    const token = await proxyGithubAuth(code);
    
    if (!token) {
      throw new Error("Failed to obtain access token from GitHub");
    }
    
    setGithubToken(token);
    toast.success("Successfully connected to GitHub");
    return true;
    
    // In a production app, you would use a real server endpoint to handle the OAuth exchange:
    /*
    const response = await fetch("/api/github/auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("GitHub API error:", errorText);
      throw new Error(`Failed to authenticate with GitHub: ${response.status} ${response.statusText}`);
    }

    const data: GithubAuthResponse = await response.json();
    setGithubToken(data.access_token);
    
    toast.success("Successfully connected to GitHub");
    return true;
    */
  } catch (error) {
    console.error("GitHub authentication error:", error);
    toast.error(`GitHub authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
};

// Get the current authenticated user
export const getCurrentGithubUser = async (): Promise<GithubUser | null> => {
  const token = getGithubToken();
  
  if (!token) {
    return null;
  }
  
  try {
    // For development/testing, return mock user data
    if (token.startsWith('github_')) {
      // Mock user data
      return {
        login: "github_user",
        id: 12345,
        name: "GitHub User",
        avatar_url: "https://avatars.githubusercontent.com/u/583231?v=4"
      };
    }
    
    // In production, use the real API
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        clearGithubToken();
      }
      throw new Error(`Failed to fetch user: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub user:", error);
    clearGithubToken(); // Clear the token if we can't fetch the user
    return null;
  }
};

// Get user repositories
export const getUserRepositories = async (): Promise<GithubRepo[]> => {
  const token = getGithubToken();
  
  if (!token) {
    toast.error("GitHub authentication required");
    return [];
  }
  
  try {
    // For development/testing, return mock repos
    if (token.startsWith('github_')) {
      // Mock repositories
      return [
        {
          id: 1,
          name: "example-repo-1",
          full_name: "github_user/example-repo-1",
          html_url: "https://github.com/github_user/example-repo-1",
          description: "This is a mock repository for testing",
          private: false,
          default_branch: "main"
        },
        {
          id: 2,
          name: "example-repo-2",
          full_name: "github_user/example-repo-2",
          html_url: "https://github.com/github_user/example-repo-2",
          description: "Another mock repository",
          private: false,
          default_branch: "main"
        }
      ];
    }
    
    const response = await fetch(`${GITHUB_API_URL}/user/repos?sort=updated`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch repositories: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching repositories:", error);
    toast.error(`Failed to fetch repositories: ${error instanceof Error ? error.message : "Unknown error"}`);
    return [];
  }
};

// Create a new file in a repository
export const createFileInRepo = async (
  repoFullName: string,
  path: string,
  content: string,
  message: string = "Add file via Agentic Development Platform"
): Promise<boolean> => {
  const token = getGithubToken();
  
  if (!token) {
    toast.error("GitHub authentication required");
    return false;
  }
  
  try {
    // Mock implementation for development
    if (token.startsWith('github_')) {
      console.log(`Mock: Creating file ${path} in ${repoFullName}`);
      toast.success(`Successfully created ${path} in ${repoFullName}`);
      return true;
    }
    
    // Get the default branch
    const repoResponse = await fetch(`${GITHUB_API_URL}/repos/${repoFullName}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!repoResponse.ok) {
      throw new Error(`Failed to fetch repository: ${repoResponse.statusText}`);
    }
    
    const repoData: GithubRepo = await repoResponse.json();
    const branch = repoData.default_branch;
    
    // Create the file
    const response = await fetch(`${GITHUB_API_URL}/repos/${repoFullName}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(content))), // Base64 encode the content with UTF-8 support
        branch,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to create file: ${response.statusText}`);
    }
    
    toast.success(`Successfully created ${path} in ${repoFullName}`);
    return true;
  } catch (error) {
    console.error("Error creating file:", error);
    toast.error(`Failed to create file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
};

// Update an existing file in a repository
export const updateFileInRepo = async (
  repoFullName: string,
  path: string,
  content: string,
  message: string = "Update file via Agentic Development Platform"
): Promise<boolean> => {
  const token = getGithubToken();
  
  if (!token) {
    toast.error("GitHub authentication required");
    return false;
  }
  
  try {
    // Mock implementation for development
    if (token.startsWith('github_')) {
      console.log(`Mock: Updating file ${path} in ${repoFullName}`);
      toast.success(`Successfully updated ${path} in ${repoFullName}`);
      return true;
    }
    
    // Get the current file to obtain its SHA
    const fileResponse = await fetch(`${GITHUB_API_URL}/repos/${repoFullName}/contents/${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!fileResponse.ok) {
      if (fileResponse.status === 404) {
        // File doesn't exist, create it instead
        return await createFileInRepo(repoFullName, path, content, message);
      }
      throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
    }
    
    const fileData = await fileResponse.json();
    
    // Update the file
    const response = await fetch(`${GITHUB_API_URL}/repos/${repoFullName}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        content: btoa(unescape(encodeURIComponent(content))), // Base64 encode the content with UTF-8 support
        sha: fileData.sha,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to update file: ${response.statusText}`);
    }
    
    toast.success(`Successfully updated ${path} in ${repoFullName}`);
    return true;
  } catch (error) {
    console.error("Error updating file:", error);
    toast.error(`Failed to update file: ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
};
