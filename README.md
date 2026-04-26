# Behavior Tree Viewer (Groot2 Viewer)

A Visual Studio Code extension for visualizing XML Behavior Trees. This extension allows you to view and interact with behavior tree XML files directly within your editor.

## Features

- **Visual Preview**: Open a graphical representation of your Behavior Tree XML files.
- **Dynamic Updates**: Preview updates as you modify the XML (if supported).
- **Interactive Layout**: Zoom and pan to navigate complex trees.
- **Node Highlighting**: Clear visualization of node types (Sequences, Fallbacks, Actions, etc.).

## Usage

1. Open a Behavior Tree XML file (`.xml`).
2. Click the **Preview** icon in the editor title menu (top right).
3. Alternatively, use the keyboard shortcut:
   - **Windows/Linux**: `Ctrl+Shift+V`
   - **macOS**: `Cmd+Shift+V`

## Supported Nodes

The viewer supports common BehaviorTree.CPP (Groot2) nodes, including:
- **Control Nodes**: Sequence, Fallback, Parallel, IfThenElse, etc.
- **Decorator Nodes**: RetryUntilSuccessful, Repeat, Inverter, etc.
- **Action/Condition Nodes**: Custom actions and conditions defined in your XML.

## Extension Settings

This extension currently does not require specific settings.

## Development

If you want to contribute or build the extension from source:

1. Clone the repository.
2. Install dependencies: `pnpm install`
3. Compile the extension: `pnpm run compile`
4. Press `F5` to open a new VS Code window with the extension loaded.

## License

This project is licensed under the [MIT License](LICENSE).
