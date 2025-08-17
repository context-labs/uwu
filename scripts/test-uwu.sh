#!/bin/bash

echo "=== uwu Context Feature Test ==="
echo ""

# Check if API key is set
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY is not set in the environment"
    echo "Please run: export OPENAI_API_KEY='your-api-key-here'"
    echo ""
    echo "Or add it to your config file at:"
    if [[ "$OSTYPE" == darwin* ]]; then
        echo "  ~/Library/Preferences/uwu/config.json"
    else
        echo "  ~/.config/uwu/config.json"
    fi
    exit 1
fi

echo "✅ OPENAI_API_KEY is set"
echo ""

# Test 1: Basic command without context
echo "Test 1: Basic command (context disabled by default)"

# Ensure binary exists
if [ ! -x "./dist/uwu-cli" ]; then
    echo "Building uwu-cli..."
    bun run build || { echo "Build failed"; exit 1; }
fi

echo "Running: ./dist/uwu-cli 'list files in current directory'"
./dist/uwu-cli "list files in current directory"
echo ""

# Create a config with context enabled
CONFIG_DIR=""
if [[ "$OSTYPE" == darwin* ]]; then
    CONFIG_DIR="$HOME/Library/Preferences/uwu"
else
    CONFIG_DIR="$HOME/.config/uwu"
fi

echo "Test 2: Creating config with context enabled"
mkdir -p "$CONFIG_DIR"
cat > "$CONFIG_DIR/config.json" << EOF
{
  "type": "OpenAI",
  "apiKey": "",
  "model": "gpt-4",
  "context": {
    "enabled": true,
    "maxHistoryCommands": 10
  }
}
EOF

echo "Config created at: $CONFIG_DIR/config.json"
echo ""

# Run some commands to build history
echo "Building command history..."
echo "$ git status"
git status
echo ""
echo "$ ls *.md"
ls *.md
echo ""

# Test with context
echo "Test 3: Command with context enabled"
echo "Running: ./dist/uwu-cli 'show me the markdown files I just listed'"
./dist/uwu-cli "show me the markdown files I just listed"

echo ""
echo "=== Test Complete ==="
