# Contributing to Unbound Debugger

Thank you for your interest in contributing to the Unbound Debugger! This tool provides a REPL (Read-Eval-Print Loop) interface for debugging Unbound instances in real-time.

## Table of Contents

- [What is the Debugger?](#what-is-the-debugger)
- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Adding Features](#adding-features)
- [Testing](#testing)
- [Common Tasks](#common-tasks)

## What is the Debugger?

The Unbound Debugger is a command-line REPL tool that connects to running Unbound instances via WebSocket. It allows developers to:

- Execute JavaScript code in the context of a running Discord client
- Inspect variables, objects, and application state
- Test plugin code interactively
- Debug issues in real-time
- Maintain command history across sessions

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) runtime installed
- Basic knowledge of TypeScript and WebSockets
- Familiarity with terminal/CLI applications

### Installation

```bash
# Clone the repository
git clone https://github.com/marioparaschiv/unbound.git
cd unbound/packages/debugger

# Install dependencies
bun install

# Link the binary for local development
bun link

# Now you can run it
ub-debugger
```

### Running in Development

```bash
# Run directly without building
bun run src/index.ts

# With custom port
bun run src/index.ts --port 9090
```

## Architecture Overview

The debugger consists of several key components:

- **WebSocket Server** - Manages client connections (one at a time) and handles bidirectional communication with Unbound instances
- **REPL Interface** - Provides an interactive command prompt for executing code in the connected client
- **History Management** - Persists command history to disk and allows navigation with arrow keys
- **CLI Parsing** - Handles command-line arguments like port configuration
- **Message Handling** - Color-codes and displays log messages by severity level

The flow is simple: user enters command → sent via WebSocket → executed in Discord → results sent back → displayed in terminal.

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Edit files in `src/`
   - Follow existing code style
   - Add TypeScript types where needed

3. **Test your changes**
   ```bash
   # Run the debugger
   bun run src/index.ts

   # In the Unbound app, connect through settings
   # (requires a running Unbound instance)
   ```

4. **Commit and push**
   ```bash
   git add .
   git commit -m "feat(debugger): add your feature"
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**

## Adding Features

The debugger is designed to be simple and extensible. Common areas for enhancement:

- **CLI flags** - Add new command-line options in the CLI parser
- **Special commands** - Add dot commands (like `.help`, `.clear`) in the REPL handler
- **Message formatting** - Customize how log messages are displayed in the terminal
- **History management** - Add filters or enhancement for command history
- **Multi-client support** - Extend the WebSocket server to handle multiple connections

Explore the codebase to understand how these components work together.

## Testing

### Manual Testing

1. Run the debugger with `bun run src/index.ts`
2. Connect from Unbound (enable debug mode in settings)
3. Test REPL commands and verify they execute correctly
4. Test command history navigation with arrow keys
5. Verify WebSocket connection handling and disconnection

You can also create a simple test WebSocket client to verify the server behavior independently of Unbound.

## Best Practices

1. **Keep it simple** - The debugger should be lightweight and fast
2. **Handle errors gracefully** - Network issues and disconnections are common
3. **Preserve history** - Users rely on command history for their workflow
4. **Use colors meaningfully** - Help users distinguish message types at a glance
5. **Document CLI flags** - Make options discoverable with `--help`

## Debugging the Debugger

If the debugger itself has issues:

- Check if the port is already in use
- Add debug logging to track execution flow
- Test the WebSocket connection independently with a tool like `wscat`
- Verify command history file permissions and location

## Dependencies

- **[Bun](https://bun.sh)** - Runtime and WebSocket server
- **[terminal-kit](https://github.com/cronvel/terminal-kit)** - Terminal UI and input handling
- **[cleye](https://github.com/privatenumber/cleye)** - CLI argument parsing

## FAQ

### Q: Why use Bun instead of Node.js?

**A:** Bun provides a built-in WebSocket server and faster startup times, making it ideal for CLI tools.

### Q: Can I use the debugger with multiple Discord clients?

**A:** Currently, only one client can connect at a time. This is by design to avoid command confusion, but multi-client support could be added.

### Q: How do I clear the command history?

**A:** Delete the history file at `~/.unbound/debugger-history.json`

### Q: Can I run the debugger on a different machine?

**A:** The debugger binds to `localhost` by default. To access it from other machines, you would need to modify the WebSocket server configuration. Be careful about security - there's no authentication.

## Need Help?

- **Found a bug?** Open an issue on GitHub
- **Have a feature idea?** Start a discussion
- **Need clarification?** Ask in your PR or issue

## Thank You!

Your contributions help make Unbound development easier for everyone!

---

**Note:** By contributing, you agree to license your contributions under the same license as the project.
