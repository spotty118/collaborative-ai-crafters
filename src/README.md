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

## Usage

### Automatic Code Syncing
When agents generate code, it will automatically be:
1. Parsed from their responses
2. Committed to your GitHub repository
3. Displayed in the Code Files tab

### Manual File Editing
1. Navigate to the Code Files tab
2. Click on any file to open the editor
3. Make your changes
4. Click Save to commit back to GitHub

### Troubleshooting

If files aren't being committed:
1. Check your GitHub token permissions
2. Ensure you're connected (green status in settings)
3. Check the browser console for any errors
4. Try reconnecting in project settings

Remember: Your GitHub token is stored securely in your browser's local storage and is only used for this project.