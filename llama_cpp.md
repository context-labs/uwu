## Running using llama.cpp for local hosting using small models like Gemma-3-4B, SmolLM3-3B

### Prerequisites
- Install [llama.cpp](https://github.com/ggerganov/llama.cpp) and build it
- Set the `LLAMA_DIR` environment variable to your llama.cpp directory:
  ```bash
  export LLAMA_DIR=/path/to/your/llama.cpp
  ```

### Quick Configuration

Choose one of these models and run the corresponding command:

# Gemma-3-4B (Balanced quality/speed - Recommended)
```bash
CONFIG_PATH=$(bun -e "import envPaths from 'env-paths'; import path from 'path'; const paths = envPaths('uwu', {suffix: ''}); console.log(path.join(paths.config, 'config.json'));") && mkdir -p "$(dirname "$CONFIG_PATH")" && echo '{"type":"LlamaCpp","model":"gemma-3-4b","contextSize":2048,"temperature":0.1,"maxTokens":150,"port":8080}' > "$CONFIG_PATH" && echo "✅ Set to Gemma-3-4B"
'''

```bash
# TinyLlama-1.1B (Fastest, basic responses)
CONFIG_PATH=$(bun -e "import envPaths from 'env-paths'; import path from 'path'; const paths = envPaths('uwu', {suffix: ''}); console.log(path.join(paths.config, 'config.json'));") && mkdir -p "$(dirname "$CONFIG_PATH")" && echo '{"type":"LlamaCpp","model":"tinyllama-1.1b","contextSize":2048,"temperature":0.1,"maxTokens":150,"port":8080}' > "$CONFIG_PATH" && echo "✅ Set to TinyLlama-1.1B"
```

# SmolLM3-3B (Small and efficient)
```bash
CONFIG_PATH=$(bun -e "import envPaths from 'env-paths'; import path from 'path'; const paths = envPaths('uwu', {suffix: ''}); console.log(path.join(paths.config, 'config.json'));") && mkdir -p "$(dirname "$CONFIG_PATH")" && echo '{"type":"LlamaCpp","model":"smollm3-3b","contextSize":2048,"temperature":0.1,"maxTokens":150,"port":8080}' > "$CONFIG_PATH" && echo "✅ Set to SmolLM3-3B"
```

### Update '~/.zshrc' to use llama-cpp
```bash
uwu() {
  local cmd
  cmd="$(uwu-cli "$@")" || return
  echo "Generated: $cmd"
  vared -p "Execute: " -c cmd
  print -s -- "$cmd"
  eval "$cmd"
}
```

#### Stop the background llama-server when done
```bash
uwu_stop() {
    pkill llama-server && echo "Llama server stopped"
}
```
#### Check current configuration
```bash
uwu_status() {
    local config_path=$(bun -e "import envPaths from 'env-paths'; import path from 'path'; const paths = envPaths('uwu', {suffix: ''}); console.log(path.join(paths.config, 'config.json'));")
    if [ -f "$config_path" ]; then
        echo "🤖 Current Configuration:"
        echo "   Provider: $(cat "$config_path" | grep -o '"type":"[^"]*"' | cut -d'"' -f4)"
        echo "   Model: $(cat "$config_path" | grep -o '"model":"[^"]*"' | cut -d'"' -f4)"
    else
        echo "❌ No configuration found"
    fi
}
```
#### Optional: Direct execution without editing (not recommended for beginners)
```bash
uwu_direct() {
    local cmd
    cmd="$(uwu-cli "$@")" || return
    echo "Executing: $cmd"
    eval "$cmd"
}
```

After updating your `~/.zshrc`, reload it:
```bash
source ~/.zshrc
```

### How LlamaCpp Mode Works

- **Background Server**: On first use, uwu automatically starts a `llama-server` in the background
- **Fast Responses**: Subsequent requests use the running server for quick responses
- **Silent Operation**: Server runs quietly without cluttering your terminal output
- **Model Download**: Models are automatically downloaded from Hugging Face on first use

### Usage Examples

#### Interactive mode with editing (recommended)
```bash
uwu "generate a new ssh key called uwu-key and add it to the ssh agent"
```
#### Check current configuration
```bash
uwu_status
```
#### Stop the server when done
```bash
uwu_stop
```

### Configuration Management

#### Switch between models quickly:
####(Use the configuration commands from the Quick Configuration section above)

#### Check if server is running:
```bash
curl -s http://localhost:8080/health && echo "Server running" || echo "Server stopped"
```
#### Find your config file location:
```bash
bun -e "import envPaths from 'env-paths'; import path from 'path'; const paths = envPaths('uwu', {suffix: ''}); console.log('Config:', path.join(paths.config, 'config.json'));"
```

### Troubleshooting

- **"LLAMA_DIR not set"**: Make sure to set the environment variable pointing to your llama.cpp directory
- **"llama-server not found"**: Ensure llama.cpp is built with server support (`make llama-server`)
- **Server won't start**: Check if port 8080 is available, or change the port in your config
- **Models downloading slowly**: First run may take time as models are downloaded from Hugging Face