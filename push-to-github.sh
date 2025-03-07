#!/bin/bash

# Initialize variables
REPO_URL=""
BRANCH="main"
COMMIT_MSG="Add CrewAI API integration"

# Display banner
echo "====================================================="
echo "      GitHub Push Helper for CrewAI Integration      "
echo "====================================================="

# Ask for GitHub repo URL if not already set
echo "Enter your GitHub repository URL (e.g., https://github.com/username/repo.git):"
read -r REPO_URL

# Check if git is initialized
if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
  git branch -M $BRANCH
fi

# Check if repository is already configured
CURRENT_REMOTE=$(git remote -v 2>/dev/null)
if [ -z "$CURRENT_REMOTE" ]; then
  echo "Setting up remote repository..."
  git remote add origin $REPO_URL
else
  echo "Remote repository already configured:"
  echo "$CURRENT_REMOTE"
  
  # Ask if user wants to change the remote
  echo "Do you want to update the remote URL? (y/n)"
  read -r UPDATE_REMOTE
  if [[ $UPDATE_REMOTE == "y" || $UPDATE_REMOTE == "Y" ]]; then
    git remote set-url origin $REPO_URL
    echo "Remote URL updated to: $REPO_URL"
  fi
fi

# Stage changes
echo "Staging all changes..."
git add .

# Commit changes
echo "Enter a commit message (or press Enter to use: \"$COMMIT_MSG\"):"
read -r USER_COMMIT_MSG
if [ ! -z "$USER_COMMIT_MSG" ]; then
  COMMIT_MSG="$USER_COMMIT_MSG"
fi

git commit -m "$COMMIT_MSG"

# Push changes
echo "Pushing to GitHub..."
git push -u origin $BRANCH

# Check if push was successful
if [ $? -eq 0 ]; then
  echo "====================================================="
  echo "      Success! Changes pushed to GitHub              "
  echo "====================================================="
else
  echo "====================================================="
  echo "      Error pushing to GitHub                        "
  echo "====================================================="
  echo ""
  echo "Some possible solutions:"
  echo ""
  echo "1. Make sure you have the correct access rights and the repository exists."
  echo "   - Check your GitHub credentials"
  echo "   - Verify the repository URL is correct"
  echo ""
  echo "2. If you're using HTTPS, you may need to provide your GitHub username and password/token."
  echo "   - Consider setting up a Personal Access Token in GitHub settings"
  echo "   - Configure git to store credentials: git config --global credential.helper store"
  echo ""
  echo "3. If you're using SSH, ensure your SSH key is properly set up."
  echo "   - Check that your SSH key is added to your GitHub account"
  echo "   - Verify your SSH agent is running: eval \$(ssh-agent -s)"
  echo ""
  echo "4. Try pushing manually with: git push -u origin $BRANCH"
  echo ""
fi
