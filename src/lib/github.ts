
import { supabase } from "@/integrations/supabase/client";

// GitHub API types
export interface GithubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
}

export interface GithubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  visibility: string;
}

// Get the GitHub client ID from environment variables
const CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID || "bb1095921a3178d546dfa6f2afc26f3e27ecd227";

// Initialize GitHub OAuth
export const initiateGitHubOAuth = () => {
  // Generate a random state value for CSRF protection
  const state = Math.random().toString(36).substring(2, 15);
  
  // Store the state in localStorage to verify later
  localStorage.setItem('github_oauth_state', state);
  
  // Get the current origin for the redirect URI
  const REDIRECT_URI = window.location.origin;
  
  // Construct the GitHub OAuth URL with proper URI encoding
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=repo&state=${state}`;
  
  // Redirect to GitHub OAuth
  window.location.href = url;
};

// Alias for compatibility with existing code
export const initiateGithubAuth = initiateGitHubOAuth;

// This function handles the OAuth callback
export const handleGitHubCallback = async (code: string, state: string) => {
  // Verify the state parameter to prevent CSRF attacks
  const storedState = localStorage.getItem('github_oauth_state');
  if (state !== storedState) {
    throw new Error('Invalid state parameter');
  }
  
  // Clear the state from localStorage
  localStorage.removeItem('github_oauth_state');
  
  try {
    // Call the Supabase Edge Function to exchange the code for an access token
    const response = await fetch('/functions/v1/github-oauth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`GitHub OAuth error: ${errorData}`);
    }
    
    const data = await response.json();
    
    // Store the access token securely
    localStorage.setItem('github_access_token', data.access_token);
    
    return data.access_token;
  } catch (error) {
    console.error('Error handling GitHub callback:', error);
    throw error;
  }
};

// Alias for compatibility with existing code
export const handleGithubCallback = handleGitHubCallback;

// Function to check if the user is authenticated with GitHub
export const isGitHubAuthenticated = () => {
  return !!localStorage.getItem('github_access_token');
};

// Function to get the GitHub access token
export const getGitHubAccessToken = () => {
  return localStorage.getItem('github_access_token');
};

// Alias for compatibility with existing code
export const getGithubToken = getGitHubAccessToken;

// Function to logout from GitHub
export const logoutGitHub = () => {
  localStorage.removeItem('github_access_token');
};

// Alias for compatibility with existing code
export const clearGithubToken = logoutGitHub;

// Function to get the current GitHub user
export const getCurrentGitHubUser = async (): Promise<GithubUser | null> => {
  const accessToken = getGitHubAccessToken();
  
  if (!accessToken) {
    return null;
  }
  
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
};

// Alias for compatibility with existing code
export const getCurrentGithubUser = getCurrentGitHubUser;

// Function to get user repos using the access token
export const getUserRepos = async (): Promise<GithubRepo[]> => {
  const accessToken = getGitHubAccessToken();
  
  if (!accessToken) {
    throw new Error('Not authenticated with GitHub');
  }
  
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        Authorization: `token ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching user repos:', error);
    throw error;
  }
};

// Alias for compatibility with existing code
export const getUserRepositories = getUserRepos;

// Helper function to extract the code and state from the URL
export const extractGitHubCallbackParams = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  
  return { code, state };
};
