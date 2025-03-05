
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

  const redirectUri = window.location.origin;
  const scope = "repo";
  
  console.log("Initiating GitHub OAuth with redirect URI:", redirectUri);
  
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
  
  window.location.href = authUrl;
};

// Handle the OAuth callback and exchange code for token
export const handleGithubCallback = async (code: string): Promise<boolean> => {
  try {
    // This request needs to be proxied through a server to avoid CORS issues
    // In a production app, you would handle this exchange server-side
    console.log("Handling GitHub callback with code:", code.substring(0, 5) + "...");
    console.log("Origin URL:", window.location.origin);
    
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
    const response = await fetch(`${GITHUB_API_URL}/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        clearGithubToken();
      }
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error fetching GitHub user:", error);
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
        content: btoa(content), // Base64 encode the content
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
        content: btoa(content), // Base64 encode the content
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
