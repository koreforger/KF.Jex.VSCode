import * as vscode from 'vscode';
import * as path from 'path';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { JexRunner } from './runner/JexRunner';
import { JexPreviewPanel } from './panels/JexPreviewPanel';

let client: LanguageClient | undefined;
let runner: JexRunner | undefined;
let fileWatcher: vscode.FileSystemWatcher | undefined;

/**
 * Called when the extension is activated.
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('JEX extension is now active');

    // Initialize the runner
    runner = new JexRunner(context.extensionPath);
    context.subscriptions.push(runner);

    const config = vscode.workspace.getConfiguration('jex');
    const serverEnabled = config.get<boolean>('languageServer.enabled', true);

    if (serverEnabled) {
        startLanguageServer(context);
    }

    // Register commands
    registerCommands(context);

    // Set up file watcher for auto-run
    setupFileWatcher(context);

    // Register configuration change handler
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('jex.languageServer.enabled')) {
                const enabled = vscode.workspace.getConfiguration('jex').get<boolean>('languageServer.enabled', true);
                if (enabled && !client) {
                    startLanguageServer(context);
                } else if (!enabled && client) {
                    stopLanguageServer();
                }
            }
        })
    );
}

/**
 * Register all extension commands.
 */
function registerCommands(context: vscode.ExtensionContext): void {
    // Run Script command
    context.subscriptions.push(
        vscode.commands.registerCommand('jex.runScript', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'jex') {
                vscode.window.showWarningMessage('Open a JEX file to run');
                return;
            }

            await runCurrentScript(context, editor.document.uri.fsPath);
        })
    );

    // Run Script with Input command
    context.subscriptions.push(
        vscode.commands.registerCommand('jex.runScriptWithInput', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'jex') {
                vscode.window.showWarningMessage('Open a JEX file to run');
                return;
            }

            const scriptPath = editor.document.uri.fsPath;
            
            // Ask user to select input file
            const inputUri = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: { 'JSON': ['json'] },
                title: 'Select Input JSON File'
            });

            if (inputUri && inputUri[0]) {
                await runCurrentScript(context, scriptPath, inputUri[0].fsPath);
            }
        })
    );

    // Show Preview Panel command
    context.subscriptions.push(
        vscode.commands.registerCommand('jex.showPreview', async () => {
            const editor = vscode.window.activeTextEditor;
            
            if (editor && editor.document.languageId === 'jex') {
                JexPreviewPanel.createOrShow(
                    context.extensionPath,
                    runner!,
                    editor.document.uri.fsPath
                );
            } else {
                JexPreviewPanel.createOrShow(context.extensionPath, runner!);
            }
        })
    );

    // Create Input File command
    context.subscriptions.push(
        vscode.commands.registerCommand('jex.createInputFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'jex') {
                vscode.window.showWarningMessage('Open a JEX file first');
                return;
            }

            const scriptPath = editor.document.uri.fsPath;
            const inputPath = await runner!.findOrCreateInputFile(scriptPath);
            
            // Open the input file
            const doc = await vscode.workspace.openTextDocument(inputPath);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            
            vscode.window.showInformationMessage(`Input file created: ${path.basename(inputPath)}`);
        })
    );

    // Show Output command
    context.subscriptions.push(
        vscode.commands.registerCommand('jex.showOutput', () => {
            runner?.showOutput();
        })
    );
}

/**
 * Run the current script and show results.
 */
async function runCurrentScript(context: vscode.ExtensionContext, scriptPath: string, inputPath?: string): Promise<void> {
    if (!runner) {
        vscode.window.showErrorMessage('JEX Runner not initialized');
        return;
    }

    // Check if CLI is available
    const cliAvailable = await runner.isCliAvailable();
    if (!cliAvailable) {
        const action = await vscode.window.showErrorMessage(
            'JEX CLI not found. The CLI is required to run scripts.',
            'Show Output'
        );
        if (action === 'Show Output') {
            runner.showOutput();
        }
        return;
    }

    // Find input file if not provided
    if (!inputPath) {
        inputPath = await runner.findOrCreateInputFile(scriptPath);
    }

    // Show progress
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running JEX script...',
        cancellable: true
    }, async (progress, token) => {
        token.onCancellationRequested(() => {
            runner?.cancelExecution();
        });

        const result = await runner!.execute(scriptPath, inputPath);

        if (result.success) {
            // Show success message with output preview
            const outputStr = JSON.stringify(result.output, null, 2);
            const preview = outputStr.length > 200 
                ? outputStr.substring(0, 200) + '...' 
                : outputStr;

            const action = await vscode.window.showInformationMessage(
                `✓ Script executed in ${result.executionTimeMs}ms`,
                'Show Output',
                'Show Preview'
            );

            if (action === 'Show Output') {
                runner!.showOutput();
            } else if (action === 'Show Preview') {
                JexPreviewPanel.createOrShow(
                    context.extensionPath,
                    runner!,
                    scriptPath
                );
            }
        } else {
            // Show error
            const errorMsg = result.errors?.[0]?.message || 'Unknown error';
            const action = await vscode.window.showErrorMessage(
                `✗ Script failed: ${errorMsg}`,
                'Show Output',
                'Go to Error'
            );

            if (action === 'Show Output') {
                runner!.showOutput();
            } else if (action === 'Go to Error' && result.errors?.[0]) {
                const err = result.errors[0];
                const doc = await vscode.workspace.openTextDocument(scriptPath);
                const editor = await vscode.window.showTextDocument(doc);
                
                if (err.line > 0) {
                    const position = new vscode.Position(err.line - 1, err.column - 1);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                }
            }
        }
    });
}

/**
 * Set up file watcher for auto-run in preview.
 */
function setupFileWatcher(context: vscode.ExtensionContext): void {
    fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{jex,json}');
    
    fileWatcher.onDidChange(async (uri) => {
        if (JexPreviewPanel.currentPanel) {
            await JexPreviewPanel.currentPanel.onFileChanged(uri);
        }
    });

    context.subscriptions.push(fileWatcher);
}

function startLanguageServer(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration('jex');
    let serverPath = config.get<string>('languageServer.path', '');

    if (!serverPath) {
        // Use bundled server
        serverPath = context.asAbsolutePath(
            path.join('server', 'Khaos.JEX.LanguageServer.exe')
        );
        
        // On non-Windows, use the dll with dotnet
        if (process.platform !== 'win32') {
            serverPath = context.asAbsolutePath(
                path.join('server', 'Khaos.JEX.LanguageServer.dll')
            );
        }
    }

    const serverOptions: ServerOptions = process.platform === 'win32' 
        ? { command: serverPath }
        : { command: 'dotnet', args: [serverPath] };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: 'file', language: 'jex' }],
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher('**/*.jex.functions.json')
        }
    };

    client = new LanguageClient(
        'jexLanguageServer',
        'JEX Language Server',
        serverOptions,
        clientOptions
    );

    client.start();
    console.log('JEX Language Server started');
}

function stopLanguageServer(): void {
    if (client) {
        client.stop();
        client = undefined;
        console.log('JEX Language Server stopped');
    }
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): Thenable<void> | undefined {
    if (client) {
        return client.stop();
    }
    return undefined;
}
