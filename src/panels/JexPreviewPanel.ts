import * as vscode from 'vscode';
import * as path from 'path';
import { JexRunner, JexExecutionResult, JexError } from '../runner/JexRunner';

/**
 * WebView panel for interactive JEX script preview.
 */
export class JexPreviewPanel implements vscode.Disposable {
    public static currentPanel: JexPreviewPanel | undefined;
    public static readonly viewType = 'jexPreview';

    private readonly panel: vscode.WebviewPanel;
    private readonly extensionPath: string;
    private readonly runner: JexRunner;
    private disposables: vscode.Disposable[] = [];
    
    private currentScriptPath: string | undefined;
    private currentInputPath: string | undefined;
    private lastResult: JexExecutionResult | undefined;
    private autoRunEnabled: boolean = true;

    private constructor(
        panel: vscode.WebviewPanel,
        extensionPath: string,
        runner: JexRunner
    ) {
        this.panel = panel;
        this.extensionPath = extensionPath;
        this.runner = runner;

        // Set initial HTML
        this.panel.webview.html = this.getWebviewContent();

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'run':
                        await this.runScript();
                        break;
                    case 'toggleAutoRun':
                        this.autoRunEnabled = message.enabled;
                        break;
                    case 'openScript':
                        if (this.currentScriptPath) {
                            const doc = await vscode.workspace.openTextDocument(this.currentScriptPath);
                            await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                        }
                        break;
                    case 'openInput':
                        if (this.currentInputPath) {
                            const doc = await vscode.workspace.openTextDocument(this.currentInputPath);
                            await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
                        }
                        break;
                    case 'copyOutput':
                        if (this.lastResult?.output) {
                            await vscode.env.clipboard.writeText(
                                JSON.stringify(this.lastResult.output, null, 2)
                            );
                            vscode.window.showInformationMessage('Output copied to clipboard');
                        }
                        break;
                }
            },
            null,
            this.disposables
        );

        // Handle panel disposal
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    /**
     * Create or show the preview panel.
     */
    public static createOrShow(
        extensionPath: string,
        runner: JexRunner,
        scriptPath?: string
    ): JexPreviewPanel {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, show it
        if (JexPreviewPanel.currentPanel) {
            JexPreviewPanel.currentPanel.panel.reveal(column);
            if (scriptPath) {
                JexPreviewPanel.currentPanel.setScript(scriptPath);
            }
            return JexPreviewPanel.currentPanel;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            JexPreviewPanel.viewType,
            'JEX Preview',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(extensionPath, 'media'))
                ]
            }
        );

        JexPreviewPanel.currentPanel = new JexPreviewPanel(panel, extensionPath, runner);

        if (scriptPath) {
            JexPreviewPanel.currentPanel.setScript(scriptPath);
        }

        return JexPreviewPanel.currentPanel;
    }

    /**
     * Set the script to preview.
     */
    public async setScript(scriptPath: string): Promise<void> {
        this.currentScriptPath = scriptPath;
        this.currentInputPath = await this.runner.findOrCreateInputFile(scriptPath);
        
        this.panel.title = `JEX Preview: ${path.basename(scriptPath)}`;
        
        // Initial run
        await this.runScript();
    }

    /**
     * Run the current script and update the preview.
     */
    public async runScript(): Promise<void> {
        if (!this.currentScriptPath) {
            return;
        }

        // Update UI to show loading state
        this.panel.webview.postMessage({
            command: 'setLoading',
            loading: true
        });

        // Execute the script
        this.lastResult = await this.runner.execute(
            this.currentScriptPath,
            this.currentInputPath
        );

        // Read input file content for display
        let inputContent = '{}';
        if (this.currentInputPath) {
            try {
                const fs = await import('fs');
                inputContent = fs.readFileSync(this.currentInputPath, 'utf8');
            } catch {
                inputContent = '{}';
            }
        }

        // Update the webview with results
        this.panel.webview.postMessage({
            command: 'updateResult',
            result: this.lastResult,
            scriptPath: this.currentScriptPath,
            inputPath: this.currentInputPath,
            inputContent: inputContent
        });
    }

    /**
     * Called when a file changes.
     */
    public async onFileChanged(uri: vscode.Uri): Promise<void> {
        if (!this.autoRunEnabled) {
            return;
        }

        const filePath = uri.fsPath;
        
        if (filePath === this.currentScriptPath || filePath === this.currentInputPath) {
            await this.runScript();
        }
    }

    /**
     * Get the webview HTML content.
     */
    private getWebviewContent(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JEX Preview</title>
    <style>
        :root {
            --bg-primary: var(--vscode-editor-background);
            --bg-secondary: var(--vscode-sideBar-background);
            --text-primary: var(--vscode-editor-foreground);
            --text-secondary: var(--vscode-descriptionForeground);
            --border-color: var(--vscode-panel-border);
            --accent-color: var(--vscode-button-background);
            --success-color: var(--vscode-testing-iconPassed);
            --error-color: var(--vscode-testing-iconFailed);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--text-primary);
            background-color: var(--bg-primary);
            padding: 16px;
            overflow-x: hidden;
        }

        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--border-color);
        }

        .header h1 {
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 500;
        }

        .status-badge.success {
            background-color: rgba(35, 134, 54, 0.2);
            color: var(--success-color);
        }

        .status-badge.error {
            background-color: rgba(248, 81, 73, 0.2);
            color: var(--error-color);
        }

        .status-badge.loading {
            background-color: rgba(255, 193, 7, 0.2);
            color: #ffc107;
        }

        .toolbar {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 12px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }

        .btn:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .btn.secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn.secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .checkbox-label {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 12px;
            cursor: pointer;
        }

        .panels {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            height: calc(100vh - 100px);
        }

        .panel {
            display: flex;
            flex-direction: column;
            border: 1px solid var(--border-color);
            border-radius: 6px;
            overflow: hidden;
        }

        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
        }

        .panel-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .panel-content {
            flex: 1;
            overflow: auto;
            padding: 12px;
        }

        pre {
            font-family: var(--vscode-editor-font-family);
            font-size: 13px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-word;
        }

        .json-key {
            color: var(--vscode-symbolIcon-propertyForeground);
        }

        .json-string {
            color: var(--vscode-symbolIcon-stringForeground);
        }

        .json-number {
            color: var(--vscode-symbolIcon-numberForeground);
        }

        .json-boolean {
            color: var(--vscode-symbolIcon-booleanForeground);
        }

        .json-null {
            color: var(--vscode-symbolIcon-nullForeground);
        }

        .error-list {
            list-style: none;
        }

        .error-item {
            padding: 8px 12px;
            margin-bottom: 8px;
            background-color: rgba(248, 81, 73, 0.1);
            border-left: 3px solid var(--error-color);
            border-radius: 4px;
        }

        .error-item .error-type {
            font-size: 11px;
            font-weight: 600;
            color: var(--error-color);
            margin-bottom: 4px;
        }

        .error-item .error-location {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 4px;
        }

        .meta-info {
            font-size: 11px;
            color: var(--text-secondary);
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid var(--border-color);
        }

        .link-btn {
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            text-decoration: underline;
        }

        .link-btn:hover {
            color: var(--vscode-textLink-activeForeground);
        }

        .spinner {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid var(--text-secondary);
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            to { transform: rotate(360deg); }
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            text-align: center;
            padding: 24px;
        }

        .empty-state svg {
            width: 48px;
            height: 48px;
            margin-bottom: 16px;
            opacity: 0.5;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>
            <span id="title">JEX Preview</span>
            <span id="statusBadge" class="status-badge" style="display: none;"></span>
        </h1>
        <div class="toolbar">
            <label class="checkbox-label">
                <input type="checkbox" id="autoRun" checked>
                Auto-run on save
            </label>
            <button class="btn secondary" id="runBtn">
                ▶ Run
            </button>
            <button class="btn secondary" id="copyBtn">
                📋 Copy Output
            </button>
        </div>
    </div>

    <div class="panels">
        <div class="panel">
            <div class="panel-header">
                <span class="panel-title">📥 Input ($in)</span>
                <span class="link-btn" id="openInputBtn">Open file</span>
            </div>
            <div class="panel-content">
                <pre id="inputContent"></pre>
            </div>
        </div>

        <div class="panel">
            <div class="panel-header">
                <span class="panel-title">📤 Output ($out)</span>
            </div>
            <div class="panel-content">
                <pre id="outputContent"></pre>
                <div id="errorList"></div>
            </div>
        </div>
    </div>

    <div class="meta-info" id="metaInfo"></div>

    <script>
        const vscode = acquireVsCodeApi();

        // Elements
        const statusBadge = document.getElementById('statusBadge');
        const inputContent = document.getElementById('inputContent');
        const outputContent = document.getElementById('outputContent');
        const errorList = document.getElementById('errorList');
        const metaInfo = document.getElementById('metaInfo');
        const autoRunCheckbox = document.getElementById('autoRun');
        const runBtn = document.getElementById('runBtn');
        const copyBtn = document.getElementById('copyBtn');
        const openInputBtn = document.getElementById('openInputBtn');

        // Event handlers
        runBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'run' });
        });

        copyBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'copyOutput' });
        });

        openInputBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'openInput' });
        });

        autoRunCheckbox.addEventListener('change', (e) => {
            vscode.postMessage({ command: 'toggleAutoRun', enabled: e.target.checked });
        });

        // Message handler
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.command) {
                case 'setLoading':
                    if (message.loading) {
                        statusBadge.className = 'status-badge loading';
                        statusBadge.innerHTML = '<span class="spinner"></span> Running...';
                        statusBadge.style.display = 'inline-flex';
                    }
                    break;

                case 'updateResult':
                    updateDisplay(message);
                    break;
            }
        });

        function updateDisplay(message) {
            const result = message.result;

            // Update status
            if (result.success) {
                statusBadge.className = 'status-badge success';
                statusBadge.innerHTML = '✓ Success';
            } else {
                statusBadge.className = 'status-badge error';
                statusBadge.innerHTML = '✗ Error';
            }
            statusBadge.style.display = 'inline-flex';

            // Update input display
            try {
                const inputJson = JSON.parse(message.inputContent);
                inputContent.innerHTML = syntaxHighlight(JSON.stringify(inputJson, null, 2));
            } catch {
                inputContent.textContent = message.inputContent || '{}';
            }

            // Update output/errors
            if (result.success && result.output) {
                outputContent.innerHTML = syntaxHighlight(JSON.stringify(result.output, null, 2));
                outputContent.style.display = 'block';
                errorList.style.display = 'none';
            } else if (result.errors && result.errors.length > 0) {
                outputContent.style.display = 'none';
                errorList.style.display = 'block';
                errorList.innerHTML = '<ul class="error-list">' +
                    result.errors.map(err => \`
                        <li class="error-item">
                            <div class="error-type">\${escapeHtml(err.type)}</div>
                            <div class="error-message">\${escapeHtml(err.message)}</div>
                            \${err.line > 0 ? \`<div class="error-location">Line \${err.line}, Column \${err.column}</div>\` : ''}
                        </li>
                    \`).join('') +
                    '</ul>';
            }

            // Update meta info
            const parts = [];
            if (result.executionTimeMs !== undefined) {
                parts.push(\`Execution time: \${result.executionTimeMs}ms\`);
            }
            if (message.scriptPath) {
                parts.push(\`Script: \${message.scriptPath.split(/[\\/\\\\]/).pop()}\`);
            }
            metaInfo.textContent = parts.join(' | ');
        }

        function syntaxHighlight(json) {
            return json.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, 
                function (match) {
                    let cls = 'json-number';
                    if (/^"/.test(match)) {
                        if (/:$/.test(match)) {
                            cls = 'json-key';
                            match = match.slice(0, -1) + '</span>:';
                            return '<span class="' + cls + '">' + escapeHtml(match.slice(0, -8)) + match.slice(-8);
                        } else {
                            cls = 'json-string';
                        }
                    } else if (/true|false/.test(match)) {
                        cls = 'json-boolean';
                    } else if (/null/.test(match)) {
                        cls = 'json-null';
                    }
                    return '<span class="' + cls + '">' + escapeHtml(match) + '</span>';
                }
            );
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }
    </script>
</body>
</html>`;
    }

    /**
     * Dispose of the panel.
     */
    public dispose(): void {
        JexPreviewPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const d = this.disposables.pop();
            if (d) {
                d.dispose();
            }
        }
    }
}
