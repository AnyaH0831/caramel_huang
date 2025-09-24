#!/bin/bash
echo "Starting build process..."
mkdir -p dist
cp index.html dist/ 2>/dev/null || echo "index.html not found"
cp styles.css dist/ 2>/dev/null || echo "styles.css not found"
cp script.js dist/ 2>/dev/null || echo "script.js not found"
cp paw_curser.svg dist/ 2>/dev/null || echo "paw_curser.svg not found"
echo "Build completed - files copied to dist"
ls -la dist/