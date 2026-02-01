import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

/**
 * Result from executing a JEX script via the CLI.
 */
export interface JexExecutionResult {
    success: boolean;
    output?: any;
    variables?: Record<string, any>;
    errors?: JexError[];
    executionTimeMs: number;
    scriptPath?: string;
    inputPath?: string;
}

export interface JexError {
    message: string;
    line: number;
    column: number;
    type: string;
}

/**
 * Manages execution of JEX scripts via the CLI.
 */
export class JexRunner implements vscode.Disposable {
    private readonly extensionPath: string;
    private readonly outputChannel: vscode.OutputChannel;
    private currentProcess: ChildProcess | null = null;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
        this.outputChannel = vscode.window.createOutputChannel('JEX Runner');
    }

    dispose(): void {
        this.outputChannel.dispose();
        this.cancelExecution();
    }

    /**
     * Gets the path to the JEX CLI executable.
     */
    private getCliPath(): string {
        const config = vscode.workspace.getConfiguration('jex');
        const customPath = config.get<string>('cli.path', '');

        if (customPath) {
            return customPath;
        }

        // Use bundled CLI
        if (process.platform === 'win32') {
            return path.join(this.extensionPath, 'cli', 'jex.exe');
        } else {
            return path.join(this.extensionPath, 'cli', 'jex.dll');
        }
    }

    /**
     * Check if CLI is available.
     */
    async isCliAvailable(): Promise<boolean> {
        const cliPath = this.getCliPath();
        
        try {
            if (process.platform === 'win32') {
                return fs.existsSync(cliPath);
            } else {
                const dllPath = cliPath;
                return fs.existsSync(dllPath);
            }
        } catch {
            return false;
        }
    }

    /**
     * Execute a JEX script file.
     */
    async execute(scriptPath: string, inputPath?: string): Promise<JexExecutionResult> {
        this.cancelExecution();

        const cliPath = this.getCliPath();
        
        // Build command arguments
        const args: string[] = [scriptPath, '--format', 'detailed'];
        
        if (inputPath) {
            args.push('--input', inputPath);
        }

        this.outputChannel.appendLine(`Executing: ${scriptPath}`);
        if (inputPath) {
            this.outputChannel.appendLine(`Input: ${inputPath}`);
        }

        return new Promise((resolve, reject) => {
            let stdout = '';
            let stderr = '';

            const isWindows = process.platform === 'win32';
            const command = isWindows ? cliPath : 'dotnet';
            const spawnArgs = isWindows ? args : [cliPath, ...args];

            this.currentProcess = spawn(command, spawnArgs, {
                cwd: path.dirname(scriptPath),
                env: { ...process.env }
            });

            this.currentProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });

            this.currentProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });

            this.currentProcess.on('close', (code) => {
                this.currentProcess = null;
                
                this.outputChannel.appendLine(`Exit code: ${code}`);

                if (stderr) {
                    this.outputChannel.appendLine(`Stderr: ${stderr}`);
                }

                try {
                    const result = JSON.parse(stdout) as JexExecutionResult;
                    this.outputChannel.appendLine(`Execution time: ${result.executionTimeMs}ms`);
                    resolve(result);
                } catch (e) {
                    // If we can't parse JSON, create an error result
                    resolve({
                        success: false,
                        errors: [{
                            message: stderr || stdout || 'Unknown error',
                            line: 0,
                            column: 0,
                            type: 'Error'
                        }],
                        executionTimeMs: 0
                    });
                }
            });

            this.currentProcess.on('error', (err) => {
                this.currentProcess = null;
                this.outputChannel.appendLine(`Error: ${err.message}`);
                resolve({
                    success: false,
                    errors: [{
                        message: `Failed to start CLI: ${err.message}`,
                        line: 0,
                        column: 0,
                        type: 'Error'
                    }],
                    executionTimeMs: 0
                });
            });
        });
    }

    /**
     * Cancel any running execution.
     */
    cancelExecution(): void {
        if (this.currentProcess) {
            this.currentProcess.kill();
            this.currentProcess = null;
            this.outputChannel.appendLine('Execution cancelled');
        }
    }

    /**
     * Find or create an input file for a script.
     */
    async findOrCreateInputFile(scriptPath: string): Promise<string> {
        const baseName = path.basename(scriptPath, '.jex');
        const dir = path.dirname(scriptPath);
        const inputPath = path.join(dir, `${baseName}.input.json`);

        if (!fs.existsSync(inputPath)) {
            // Create a default input file
            const defaultInput = {
                "comment": "Input data for JEX script. Edit this file and re-run.",
                "example": {
                    "name": "World",
                    "items": [1, 2, 3]
                }
            };
            fs.writeFileSync(inputPath, JSON.stringify(defaultInput, null, 2));
        }

        return inputPath;
    }

    /**
     * Show the output channel.
     */
    showOutput(): void {
        this.outputChannel.show();
    }
}
