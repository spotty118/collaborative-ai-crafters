#!/bin/zsh
echo "Installing dependencies..."
npm install
echo "Building project..."
npm run build
echo "Previewing production build..."
npm run preview
