// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2026 Jonathan D.A. Jewell <jonathan.jewell@open.ac.uk>

import * as vscode from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  console.log('Claude Firefox LSP extension activated');

  // Server executable
  const config = vscode.workspace.getConfiguration('claude-firefox-lsp');
  const serverPath = config.get<string>('serverPath', 'claude-firefox-lsp');

  const serverOptions: ServerOptions = {
    command: serverPath,
    args: [],
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [],
    synchronize: {
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*'),
    },
  };

  client = new LanguageClient(
    'claude-firefox-lsp',
    'Claude Firefox LSP',
    serverOptions,
    clientOptions
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('claude-firefox-lsp.navigate', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'Enter URL to navigate to',
        placeHolder: 'https://example.com',
      });

      if (url) {
        const result = await client.sendRequest('workspace/executeCommand', {
          command: 'firefox.navigate',
          arguments: [url],
        });
        vscode.window.showInformationMessage(`Navigated to ${url}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-firefox-lsp.click', async () => {
      const selector = await vscode.window.showInputBox({
        prompt: 'Enter CSS selector or XPath',
        placeHolder: '#submit-button',
      });

      if (selector) {
        await client.sendRequest('workspace/executeCommand', {
          command: 'firefox.click',
          arguments: [selector],
        });
        vscode.window.showInformationMessage(`Clicked element: ${selector}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-firefox-lsp.typeText', async () => {
      const selector = await vscode.window.showInputBox({
        prompt: 'Enter CSS selector or XPath',
        placeHolder: '#search-input',
      });

      if (!selector) return;

      const text = await vscode.window.showInputBox({
        prompt: 'Enter text to type',
        placeHolder: 'Hello, world!',
      });

      if (text) {
        await client.sendRequest('workspace/executeCommand', {
          command: 'firefox.typeText',
          arguments: [selector, text],
        });
        vscode.window.showInformationMessage(`Typed text into: ${selector}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-firefox-lsp.screenshot', async () => {
      const result: any = await client.sendRequest('workspace/executeCommand', {
        command: 'firefox.screenshot',
        arguments: [],
      });

      if (result?.screenshot) {
        const buffer = Buffer.from(result.screenshot, 'base64');
        const uri = vscode.Uri.parse(`data:image/png;base64,${result.screenshot}`);
        vscode.window.showInformationMessage('Screenshot captured');
        // TODO: Display or save screenshot
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-firefox-lsp.executeJs', async () => {
      const javascript = await vscode.window.showInputBox({
        prompt: 'Enter JavaScript to execute',
        placeHolder: 'return document.title;',
      });

      if (javascript) {
        const result: any = await client.sendRequest('workspace/executeCommand', {
          command: 'firefox.executeJs',
          arguments: [javascript],
        });
        vscode.window.showInformationMessage(`Result: ${JSON.stringify(result)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-firefox-lsp.getContent', async () => {
      const format = await vscode.window.showQuickPick(['html', 'text', 'dom'], {
        placeHolder: 'Select content format',
      });

      if (format) {
        const result: any = await client.sendRequest('workspace/executeCommand', {
          command: 'firefox.getContent',
          arguments: [{ format }],
        });

        if (result?.content) {
          const doc = await vscode.workspace.openTextDocument({
            content: result.content,
            language: format === 'html' ? 'html' : 'plaintext',
          });
          vscode.window.showTextDocument(doc);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('claude-firefox-lsp.detectBrowsers', async () => {
      const result: any = await client.sendRequest('workspace/executeCommand', {
        command: 'firefox.detectBrowsers',
        arguments: [],
      });

      if (result?.browsers) {
        const browsers = result.browsers.map((b: any) => b[1].name).join(', ');
        vscode.window.showInformationMessage(`Available browsers: ${browsers}`);
      }
    })
  );

  // Start the client
  client.start();
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}
