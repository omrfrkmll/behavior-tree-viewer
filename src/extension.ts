import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

        if (this._panel) {
            this._panel.reveal(column);
            this._update(editor.document.getText());
            return;
        }

        this._panel = vscode.window.createWebviewPanel(
            BehaviorTreePreviewManager.viewType,
            'Behavior Tree Studio',
            column,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._context.extensionUri, 'dist-app'),
                    vscode.Uri.joinPath(this._context.extensionUri, 'dist')
                ],
                retainContextWhenHidden: true
            }
        );

        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);

        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        this._panel.webview.onDidReceiveMessage(message => {
            switch (message.type) {
                case 'edit':
                    this._handleEdit(message.text);
                    return;
                case 'reveal':
                    if (this._activeTextEditor && typeof message.line === 'number') {
                        const line = message.line;
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
        const distAppUri = vscode.Uri.joinPath(this._context.extensionUri, 'dist-app');
        const indexPath = path.join(this._context.extensionPath, 'dist-app', 'index.html');

        if (fs.existsSync(indexPath)) {
            let html = fs.readFileSync(indexPath, 'utf8');

            // Replace /assets/ or ./assets/ or assets/ with webview.asWebviewUri
            html = html.replace(/(?:src|href)="(?:\/|\.\/)?(assets\/[^"]+)"/g, (match, assetPath) => {
                const assetUri = webview.asWebviewUri(vscode.Uri.joinPath(distAppUri, assetPath));
                const attr = match.startsWith('src') ? 'src' : 'href';
                return `${attr}="${assetUri.toString()}"`;
            });

            return html;
        }

        return `<!DOCTYPE html><html><body><p>Error: dist-app/index.html not found. Please build the webview first with <code>pnpm run app:build</code>.</p></body></html>`;
    }
}

export function deactivate() { }
