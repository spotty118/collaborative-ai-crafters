import { GitHubService as BaseGitHubService, createGitHubService } from '../github';

let instance: BaseGitHubService | null = null;

export const getGitHubService = () => {
  if (!instance) {
    throw new Error('GitHub service not initialized');
  }
  return instance;
};

export const initGitHubService = (url: string, token: string) => {
  instance = createGitHubService(url, token);
  return instance;
};

export const clearGitHubService = () => {
  instance = null;
};
