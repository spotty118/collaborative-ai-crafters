
# GitHub Integration Guide

## Setup

1. Create a GitHub Personal Access Token:
   - Go to GitHub Settings > Developer Settings > Personal Access Tokens
   - Create a new token with 'repo' scope
   - Copy the token (you won't be able to see it again)

2. Import or Create a Project:
   - For existing repositories: Import and provide the GitHub repo URL
   - For new projects: Create and link to a new GitHub repo

3. Configure GitHub Access:
   - Go to project settings tab
   - Enter your GitHub token
   - Click "Connect GitHub"
   - Look for the green "Connected" status indicator

## Troubleshooting

If changes aren't being committed to GitHub:

1. Check your connection:
   - Verify the green "Connected" status in the settings tab
   - Try disconnecting and reconnecting with your token

2. Check your token:
   - Ensure your token has the 'repo' scope
   - Create a new token if needed and update it in settings

3. Debug common issues:
   - Check browser console for any errors (F12 to open developer tools)
   - Ensure the repository URL is correct (should be in format: https://github.com/username/repo)
   - Make sure the repository exists and you have write access

4. Ensure proper commit messages:
   - When saving files, use descriptive commit messages
   - Avoid special characters in commit messages

Remember: Your GitHub token is stored securely in your browser's local storage and is only used for this project.
