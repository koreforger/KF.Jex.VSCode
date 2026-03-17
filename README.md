# Khaos JEX - VS Code Extension

Language support for the **JEX JSON transformation DSL** in Visual Studio Code.

## Features

### 🎨 Syntax Highlighting
Full TextMate grammar support for JEX scripts with proper highlighting of:
- Keywords (`%let`, `%set`, `%if`, `%foreach`, `%func`, etc.)
- Built-in variables (`$in`, `$out`, `$meta`)
- JSONPath expressions
- Functions and operators
- Comments and strings

### 🧠 Language Server
Advanced IDE features powered by the JEX Language Server:
- **Completions**: Keywords, built-ins, JSONPath, user functions
- **Hover**: Documentation and type information
- **Diagnostics**: Real-time syntax error reporting
- **Go to Definition**: Navigate to function definitions

### ▶️ Script Runner
Run JEX scripts directly from VS Code without writing C# code:
- **Run Script** (`Ctrl+Shift+R`): Execute the current script
- **Run Script with Input**: Choose a custom input file
- **Create Input File**: Generate a companion `.input.json` file

### 📊 Interactive Preview Panel
Live preview of script execution with side-by-side comparison:
- See input (`$in`) and output (`$out`) simultaneously
- **Auto-run on save**: Instant feedback as you edit
- Copy output to clipboard
- Navigate to errors in source

### 📝 Snippets
Quick code templates for common patterns:
- `let` - Variable declaration
- `set` - Output assignment
- `if` - Conditional statement
- `foreach` - Loop iteration
- `func` - Function definition
- And more...

## Getting Started

### 1. Create a JEX Script

Create a new file with `.jex` extension:

```jex
// hello.jex
%let name = jp1($in, "$.name");
%set $.greeting = concat("Hello, ", name, "!");
```

### 2. Create an Input File

Create a companion input file `hello.input.json`:

```json
{
  "name": "World"
}
```

### 3. Run the Script

Either:
- Press `Ctrl+Shift+R` to run
- Right-click → **JEX: Run Script**
- Use Command Palette → **JEX: Run Script**

### 4. Open Preview Panel

Press `Ctrl+Shift+P` (while in a `.jex` file) or use Command Palette → **JEX: Show Preview Panel** for an interactive side-by-side view.

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| JEX: Run Script | `Ctrl+Shift+R` | Execute the current JEX script |
| JEX: Run Script with Input... | - | Run with a custom input file |
| JEX: Show Preview Panel | `Ctrl+Shift+P` | Open interactive preview |
| JEX: Create Input File | - | Create companion input file |
| JEX: Show Output | - | Show runner output channel |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `jex.languageServer.enabled` | `true` | Enable the JEX Language Server |
| `jex.languageServer.path` | `""` | Custom path to Language Server |
| `jex.cli.path` | `""` | Custom path to JEX CLI |
| `jex.preview.autoRun` | `true` | Auto-run on save in preview panel |

## File Conventions

The extension uses file naming conventions for automatic input discovery:

| Script | Input (auto-discovered) |
|--------|------------------------|
| `transform.jex` | `transform.input.json` |
| `process.jex` | `process.input.json` |

## Requirements

- **.NET 10 Runtime**: Required to run the Language Server and CLI
- **VS Code 1.85+**: Minimum version required

## Examples

See the [examples](./examples/) folder for sample scripts.

## License

MIT License - See [LICENSE.md](LICENSE.md)

## Related Projects

- [KhaosKode.JEX](../KhaosKode.Jex/) - Core JEX library
- [KhaosKode.JEX.LanguageServer](../KhaosKode.JEX.LanguageServer/) - Language Server implementation
- [KhaosKode.JEX.Cli](../KhaosKode.JEX.Cli/) - Command-line interface
