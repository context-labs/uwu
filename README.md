<h1 align="center">
  <br>
  <a href="https://github.com/context-labs/uwu"><img src="https://raw.githubusercontent.com/context-labs/uwu/main/assets/uwu.jpg" alt="uwu" width="200" style="border-radius:8px;"></a>
   <br>
  uwu
  <br>
</h1>

<h4 align="center">✨ Natural language to shell commands using AI ✨</h4>

<p align="center">
  <a href="https://x.com/inference_net">
    <img alt="X (formerly Twitter)" src="https://img.shields.io/badge/X-@inference.net-1DA1F2?style=flat&logo=x&logoColor=white" />
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  </a>
  <a href="https://github.com/context-labs/uwu">
    <img alt="GitHub" src="https://img.shields.io/github/stars/context-labs/uwu?style=social" />
  </a>
  
</p>

<p align="center">
  <a href="#what-is-this">What is this?</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#contributing">Contributing</a>
</p>

## What is this?

`uwu` is a lightweight, focused CLI tool that converts natural language into shell commands using Large Language Models (LLMs) like GPT-5. Unlike comprehensive agentic development tools like [Claude Code](https://www.anthropic.com/claude-code) or [Cursor](https://cursor.com), `uwu` has a simple, singular purpose: **helping you write shell commands faster, without switching context**.

`uwu` is not a replacement for comprehensive agentic development tools -- it is simple tool that excels at one thing. Consider it the terminal equivalent of quickly searching "how do I..." and getting an immediately runnable answer.

![uwu demo](https://raw.githubusercontent.com/context-labs/uwu/main/assets/uwu.gif)

After a response is generated, you can edit it before pressing enter to execute the command. This is useful if you want to add flags, or other modifications to the command.

## Installation

### 1. Clone the repo

```bash
git clone https://github.com/context-labs/uwu.git
cd uwu
```

### 2. Install dependencies and build

Make sure you have [Bun](https://bun.sh) installed.

```bash
bun install
bun run build
```

This will produce the `uwu-cli` binary in the `dist/` build output directory.

### 3. Make the binary executable and move it into your PATH

```bash
chmod +x dist/uwu-cli
mv dist/uwu-cli /usr/local/bin/uwu-cli
```

### 4. Configuration

`uwu` is configured through a single `config.json` file. The first time you run `uwu`, it will automatically create a default configuration file to get you started.

#### Configuration File Location

The `config.json` file is located in a standard, platform-specific directory:

- **Linux:** `~/.config/uwu/config.json`
- **macOS:** `~/Library/Preferences/uwu/config.json`
- **Windows:** `%APPDATA%\\uwu\\config.json` (e.g., `C:\\Users\\<user>\\AppData\\Roaming\\uwu\\config.json`)

#### Provider Types

You can configure `uwu` to use different AI providers by setting the `type` field in your `config.json`. The supported types are `"OpenAI"`, `"Custom"`, `"Claude"`, `"Gemini"`, and `"GitHub"`.

Below are examples for each provider type.

---

##### **1. OpenAI (`type: "OpenAI"`)**

This is the default configuration.

```json
{
  "type": "OpenAI",
  "apiKey": "sk-your_openai_api_key",
  "model": "gpt-4.1"
}
```

- `apiKey`: Your OpenAI API key. If this is empty, `uwu` will use the `OPENAI_API_KEY` environment variable.

---

##### **2. Claude (`type: "Claude"`)**

Uses the native Anthropic API.

```json
{
  "type": "Claude",
  "apiKey": "your-anthropic-api-key",
  "model": "claude-3-opus-20240229"
}
```

- `apiKey`: Your Anthropic API key.

---

##### **3. Gemini (`type: "Gemini"`)**

Uses the native Google Gemini API.

```json
{
  "type": "Gemini",
  "apiKey": "your-google-api-key",
  "model": "gemini-pro"
}
```

- `apiKey`: Your Google AI Studio API key.

---

##### **4. GitHub (`type: "GitHub"`)**
Uses multiple free to use GitHub models.
```json
{
  "type": "GitHub",
  "apiKey": "your-github-token",
  "model": "openai/gpt-4.1-nano"
}
```

- `apiKey`: Your GitHub token.

---

##### **5. Custom / Local Models (`type: "Custom"`)**

This type is for any other OpenAI-compatible API endpoint, such as Ollama, LM Studio, or a third-party proxy service.

```json
{
  "type": "Custom",
  "model": "llama3",
  "baseURL": "http://localhost:11434/v1",
  "apiKey": "ollama"
}
```

- `model`: The name of the model you want to use (e.g., `"llama3"`).
- `baseURL`: The API endpoint for the service.
- `apiKey`: An API key, if required by the service. For local models like Ollama, this can often be a non-empty placeholder like `"ollama"`.

---

#### Context Configuration (Optional)

`uwu` can include recent command history from your shell to provide better context for command generation. This feature is disabled by default but can be enabled. When enabled, `uwu` includes the raw last N lines from your shell history (e.g., bash, zsh, fish), preserving any extra metadata your shell records:

```json
{
  "type": "OpenAI",
  "apiKey": "sk-your_api_key",
  "model": "gpt-4.1",
  "context": {
    "enabled": true,
    "maxHistoryCommands": 10
  }
}
```

- `enabled`: Whether to include command history context (default: `false`)
- `maxHistoryCommands`: Number of recent commands to include (default: `10`)
  When enabled, `uwu` automatically detects and parses history from bash, zsh, and fish shells.

##### Notes on history scanning performance

- **Chunk size unit**: When scanning shell history files, `uwu` reads from the end of the file in fixed-size chunks of 64 KiB. This is not currently configurable but can be made if desired.

##### Windows notes

- **History detection**: On Windows, `uwu` searches for PowerShell PSReadLine history at:
  - `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` (Windows PowerShell 5.x)
  - `%APPDATA%\Microsoft\PowerShell\PSReadLine\ConsoleHost_history.txt` (PowerShell 7+)
    If not found, it falls back to Unix-like history files that may exist when using Git Bash/MSYS/Cygwin (e.g., `.bash_history`, `.zsh_history`).
- **Directory listing**: On Windows, directory listing uses `dir /b`; on Linux/macOS it uses `ls`.

### 5. Add the `uwu` helper function to your `~/.zshrc`

This function lets you type `uwu <description>` and get an editable command preloaded in your shell.


```zsh
# ~/.zshrc
```
```bash
uwu() {
  local cmd
  cmd="$(uwu-cli "$@")" || return
  vared -p "" -c cmd
  print -s -- "$cmd"   # add to history
  eval "$cmd"
}
```

After editing `~/.zshrc`, reload it:

## Running with `llama.cpp` for Local Hosting (Small Models: Gemma-3-4B, SmolLM3-3B-GGUF)

### 1. Configure `uwu` to use `llama.cpp`
```bash
CONFIG_PATH=$(bun -e "import envPaths from 'env-paths'; import path from 'path'; const paths = envPaths('uwu', {suffix: ''}); console.log(path.join(paths.config, 'config.json'));") \
&& mkdir -p "$(dirname "$CONFIG_PATH")" \
&& echo '{"type":"LlamaCpp","model":"gemma-3-4b","contextSize":2048,"temperature":0.1,"maxTokens":150,"port":8080}' > "$CONFIG_PATH" \
&& echo "Configuration set for Gemma-3-4B"
```
You can put more options in llama_cpp.md. 

## 2. Update ~/.zshrc to Add Helper Functions
### 2.1 For running llama-cpp to generate and execute function
```bash
uwu() {
  local cmd
  cmd="$(dist/uwu-cli "$@")" || return
  echo "Generated: $cmd"
  vared -p "Execute: " -c cmd
  print -s -- "$cmd"
  eval "$cmd"
}
```
#### 2.1.  Stop the llama.cpp server
```bash
uwu_stop() {
  pkill llama-server && echo "Llama server stopped"
}
```
#### 2.2. Direct execution without editing (Not recommended)
```bash
uwu_direct() {
  local cmd
  cmd="$(dist/uwu-cli "$@")" || return
  echo "Executing: $cmd"
  eval "$cmd"
}
```

⸻

📄 For more details, see llama_cpp.md.

#### bash
```bash
uwu() {
  local cmd
  cmd="$(uwu-cli "$@")" || return
  # requires interactive shell and Bash 4+
  read -e -i "$cmd" -p "" cmd || return
  builtin history -s -- "$cmd"
  eval -- "$cmd"
}
```

## Usage

Once installed and configured:

```bash
uwu generate a new ssh key called uwu-keyand add it to the ssh agent
```

You'll see the generated command in your shell's input line. Press **Enter** to run it, or edit it first. Executed commands will show up in your shell's history just like any other command.

with llama.cpp

# Interactive mode with editing
```bash 
uwu generate a new ssh key called uwu-keyand add it to the ssh agent
```
# kill llama.cpp if you are not using it anymore to stop
```bash 
uwu_stop
```
## License

[MIT](LICENSE)

## Contributing

Contributions are welcome! Please feel free to submit a pull request.
