import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Groot2 Viewer is now active!');
    vscode.window.showInformationMessage('Groot2 Viewer Activate!');
    const manager = new BehaviorTreePreviewManager(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('groot2-viewer.openPreview', () => {
            manager.createOrShow();
        })
    );
}

class BehaviorTreePreviewManager {
    public static readonly viewType = 'groot2-viewer.preview';
    private _panel: vscode.WebviewPanel | undefined;
    private _disposables: vscode.Disposable[] = [];
    private _activeTextEditor: vscode.TextEditor | undefined;

    constructor(private readonly _context: vscode.ExtensionContext) {
        // Listen to active editor changes to switch the graph context if we want to support multiple files
        // For now, let's keep it simple: The preview captures the *current* file when opened.
        // Update: The plan says "Standard Editor + Side Panel". Ideally, the panel follows the active editor.

        vscode.workspace.onDidChangeTextDocument(e => {
            if (this._panel && this._activeTextEditor && e.document.uri.toString() === this._activeTextEditor.document.uri.toString()) {
                this._update(e.document.getText());
            }
        }, null, this._disposables);

        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (this._panel && editor && editor.document.languageId === 'xml') {
                this._activeTextEditor = editor;
                this._update(editor.document.getText());
            }
        }, null, this._disposables);
    }

    public createOrShow() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active XML editor found.');
            return;
        }

        this._activeTextEditor = editor;

        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, show it.
        if (this._panel) {
            this._panel.reveal(column);
            this._update(editor.document.getText());
            return;
        }

        // Otherwise, create a new panel.
        this._panel = vscode.window.createWebviewPanel(
            BehaviorTreePreviewManager.viewType,
            'Behavior Tree Preview',
            column,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, 'dist')],
                retainContextWhenHidden: true
            }
        );

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'edit':
                    this._handleEdit(message.text);
                    return;
                case 'reveal':
                    if (this._activeTextEditor && typeof message.line === 'number') {
                        const line = message.line;
                        // Create a range for the whole line
                        const range = this._activeTextEditor.document.lineAt(line).range;
                        this._activeTextEditor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                        this._activeTextEditor.selection = new vscode.Selection(range.start, range.end);
                    }
                    return;
            }
        }, null, this._disposables);

        this._update(editor.document.getText());
    }

    private _handleEdit(text: string) {
        if (this._activeTextEditor) {
            const document = this._activeTextEditor.document;
            const edit = new vscode.WorkspaceEdit();
            // Just replacing the whole document for now as per previous logic.
            // In the future for "smart edits", we would pass ranges.
            edit.replace(
                document.uri,
                new vscode.Range(0, 0, document.lineCount, 0),
                text
            );
            vscode.workspace.applyEdit(edit);
        }
    }

    private _update(text: string) {
        if (this._panel) {
            this._panel.webview.postMessage({ type: 'update', text: text });
        }
    }

    public dispose() {
        if (this._panel) {
            this._panel.dispose();
            this._panel = undefined;
        }

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview.js'));
        const nonce = getNonce();

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Behavior Tree Viewer</title>
                <style>
                    body, html {
                        margin: 0;
                        padding: 0;
                        width: 100%;
                        height: 100%;
                        overflow: hidden;
                        background-color: #1e1e1e;
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #ccc;
                    }
                    .container {
                        display: flex;
                        height: 100%;
                        width: 100%;
                    }
                    /* Left Panel: Palette */
                    #palette-panel {
                        width: 200px;
                        background-color: #252526;
                        border-right: 1px solid #333;
                        display: flex;
                        flex-direction: column;
                        overflow: hidden;
                    }
                    #palette-header {
                        padding: 10px;
                        background-color: #2d2d2d;
                        font-weight: bold;
                        border-bottom: 1px solid #333;
                        text-align: center;
                    }
                    #palette-content {
                        flex-grow: 1;
                        overflow-y: auto;
                        padding: 10px;
                    }
                    .palette-group {
                        margin-bottom: 15px;
                    }
                    .palette-group-title {
                        font-size: 12px;
                        text-transform: uppercase;
                        color: #888;
                        margin-bottom: 5px;
                        font-weight: bold;
                    }
                    .palette-item {
                        padding: 5px 10px;
                        background-color: #333;
                        margin-bottom: 4px;
                        border-radius: 3px;
                        cursor: grab;
                        font-size: 13px;
                        display: flex;
                        align-items: center;
                    }
                    .palette-item:hover {
                        background-color: #444;
                    }
                    .palette-item-icon {
                        width: 10px;
                        height: 10px;
                        margin-right: 8px;
                        border-radius: 50%;
                    }

                    /* Center Panel: Canvas */
                    #canvas-panel {
                        flex-grow: 1;
                        display: flex;
                        flex-direction: column;
                        position: relative;
                        overflow: hidden;
                    }
                    #tree-toolbar {
                        padding: 5px 10px;
                        background-color: #2d2d2d;
                        border-bottom: 1px solid #333;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                        font-size: 12px;
                    }
                    #tree-svg-container {
                        flex-grow: 1;
                        width: 100%;
                        height: 100%;
                        background-color: #1e1e1e; /* Dots pattern maybe? */
                    }

                    /* Right Panel: Properties */
                    #properties-panel {
                        width: 250px;
                        background-color: #252526;
                        border-left: 1px solid #333;
                        display: flex;
                        flex-direction: column;
                    }
                    #properties-header {
                        padding: 10px;
                        background-color: #2d2d2d;
                        font-weight: bold;
                        border-bottom: 1px solid #333;
                    }
                    #properties-content {
                        padding: 15px;
                        flex-grow: 1;
                        overflow-y: auto;
                    }
                    .form-group {
                        margin-bottom: 12px;
                    }
                    .form-group label {
                        display: block;
                        margin-bottom: 4px;
                        font-size: 11px;
                        color: #888;
                    }
                    .form-group input {
                        width: 100%;
                        padding: 5px;
                        background-color: #3c3c3c;
                        border: 1px solid #333;
                        color: #ccc;
                        border-radius: 2px;
                    }
                    .form-group input:focus {
                        outline: 1px solid #007fd4;
                        border-color: #007fd4;
                    }

                    /* D3 Styles */
                    svg { width: 100%; height: 100%; }
                    .node rect {
                        fill: #333;
                        stroke: #555;
                        stroke-width: 1.5px;
                        transition: all 0.2s;
                    }
                    .node.selected rect {
                        stroke: #007fd4;
                        stroke-width: 2.5px;
                        filter: drop-shadow(0 0 4px rgba(0,127,212,0.5));
                    }
                    .node text { font: 12px sans-serif; fill: #eee; pointer-events: none; }
                    .link { fill: none; stroke: #555; stroke-width: 1.5px; transition: stroke 0.3s; }

                    /* Status Styles */
                    .status-running {
                        fill: #4b4b1a !important; /* Dark yellow/gold */
                        stroke: #ffd700 !important;
                        stroke-width: 3px !important;
                        filter: drop-shadow(0 0 6px rgba(255, 215, 0, 0.6));
                    }
                    .status-success {
                        fill: #1a3a1a !important; /* Dark green */
                        stroke: #28a745 !important;
                        stroke-width: 3px !important;
                    }
                    .status-failure {
                        fill: #3a1a1a !important; /* Dark red */
                        stroke: #dc3545 !important;
                        stroke-width: 3px !important;
                    }

                    @keyframes pulse-yellow {
                        0% { filter: drop-shadow(0 0 2px rgba(255, 215, 0, 0.4)); }
                        50% { filter: drop-shadow(0 0 10px rgba(255, 215, 0, 0.8)); }
                        100% { filter: drop-shadow(0 0 2px rgba(255, 215, 0, 0.4)); }
                    }
                    .node.running rect {
                        animation: pulse-yellow 1.5s infinite;
                    }

                    /* Button */
                    .btn {
                        padding: 5px 10px;
                        background-color: #0e639c;
                        color: white;
                        border: none;
                        border-radius: 2px;
                        cursor: pointer;
                        font-size: 11px;
                    }
                    .btn:hover:not(:disabled) { background-color: #1177bb; }
                    .btn-danger { background-color: #a1260d; }
                    .btn-danger:hover:not(:disabled) { background-color: #c93b1d; }
                    .btn-success { background-color: #107c10; }
                    .btn-success:hover:not(:disabled) { background-color: #1a9e1a; }
                    .btn-warning { background-color: #8a8a10; }
                    .btn-warning:hover:not(:disabled) { background-color: #aaaa15; }
                    
                    .btn:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                        filter: grayscale(1);
                    }
                    
                    /* Modal */
                    .modal-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.5);
                        z-index: 1000;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .modal-content {
                        background-color: #252526;
                        border: 1px solid #454545;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                        width: 300px;
                        border-radius: 4px;
                        display: flex;
                        flex-direction: column;
                    }
                    .modal-header {
                        padding: 10px;
                        background-color: #2d2d2d;
                        border-bottom: 1px solid #333;
                        font-weight: bold;
                    }
                    .modal-body {
                        padding: 15px;
                    }
                    .modal-footer {
                        padding: 10px;
                        border-top: 1px solid #333;
                        display: flex;
                        justify-content: flex-end;
                        gap: 10px;
                    }
                    .modal-input {
                        width: 100%;
                        padding: 6px;
                        background-color: #3c3c3c;
                        border: 1px solid #333;
                        color: #ccc;
                        box-sizing: border-box;
                        margin-top: 5px;
                    }
                    .modal-select {
                        width: 100%;
                        padding: 6px;
                        background-color: #3c3c3c;
                        border: 1px solid #333;
                        color: #ccc;
                        margin-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- PALETTE -->
                    <div id="palette-panel">
                        <div id="palette-header">Node Library</div>
                        <div id="palette-content"></div>
                    </div>

                    <!-- CANVAS -->
                    <div id="canvas-panel">
                        <div id="tree-toolbar">
                             <span style="flex-grow:1"></span>
                             <button class="btn" id="start-sim-btn">Start Sim</button>
                             <button class="btn" id="step-sim-btn">Step</button>
                             <button class="btn btn-success" id="force-success-btn" title="Force Success" disabled>Success</button>
                             <button class="btn btn-danger" id="force-failure-btn" title="Force Failure" disabled>Fail</button>
                             <button class="btn btn-warning" id="force-running-btn" title="Force Running" disabled>Running</button>
                             <button class="btn" id="stop-sim-btn" style="display:none;">Stop Sim</button>
                             <button class="btn" id="auto-layout-btn" title="Reset View">Center View</button>
                        </div>
                        <div id="tree-svg-container">
                            <svg></svg>
                        </div>
                    </div>

                    <!-- PROPERTIES -->
                    <div id="properties-panel">
                        <div id="properties-header">Properties</div>
                        <div id="properties-content">
                            <div style="color: #666; font-style: italic; text-align: center; margin-top: 20px;">
                                Select a node to edit properties
                            </div>
                        </div>
                    </div>
                </div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function deactivate() { }
