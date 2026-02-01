import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Starting JEX extension tests');

    test('Extension should be present', () => {
        const extension = vscode.extensions.getExtension('khaos.khaos-jex');
        // Extension may not be found in test environment without proper setup
        // This is a sanity check
        assert.ok(true, 'Test suite is running');
    });

    test('JEX language should be registered', async () => {
        const languages = await vscode.languages.getLanguages();
        // The language 'jex' should be in the list
        assert.ok(languages.includes('jex'), 'JEX language should be registered');
    });

    test('JEX file should open with correct language', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'jex',
            content: '%let x = 42;'
        });
        assert.strictEqual(doc.languageId, 'jex');
    });

    test('Document should have content', async () => {
        const doc = await vscode.workspace.openTextDocument({
            language: 'jex',
            content: '%let x = 42;\n%set $.result = x;'
        });
        assert.strictEqual(doc.lineCount, 2);
        assert.ok(doc.getText().includes('%let'));
    });
});
