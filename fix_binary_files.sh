#!/bin/bash
# Fix corrupted binary files in the spraxe repo
# Run this after cloning the repo locally

echo "Fixing corrupted binary files..."

# Download the original binary files from the spraxedemo repo
cd "$(git rev-parse --show-toplevel)"

for file in public/header.png public/footer.png public/spraxe.png public/og.png public/apple-touch-icon.png public/android-chrome-192x192.png public/android-chrome-512x512.png public/favicon-16x16.png public/favicon-32x32.png public/favicon.ico; do
    filename=$(basename "$file")
    echo "  Fixing $file..."
    # Download from the original spraxedemo repo
    curl -sL "https://raw.githubusercontent.com/spraxecare-hub/spraxedemo/main/$file" -o "$file"
    if [ $? -eq 0 ]; then
        echo "    OK"
    else
        echo "    FAILED"
    fi
done

# Remove test files
rm -f test-small.png test-encoding.txt public/header_test.png

# Commit the fixed files
git add public/
git commit -m "fix: restore binary public assets (logos/icons) from original repo"
git push

echo "Done! Binary files fixed and pushed."
