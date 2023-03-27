import * as vscode from 'vscode';
import { MarklogicClient } from './marklogicClient';
import { cascadeOverrideClient } from './vscQueryParameterTools';

const SJS = 'sjs';

export class MlxprsStatus {
    private mlClient: MarklogicClient;
    private statusBarItem: vscode.StatusBarItem;
    private commandId = 'mlxprs.showConnectedServers';
    private command: vscode.Disposable;
    private connectedServers = null;

    constructor(context: vscode.ExtensionContext) {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        this.mlClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.command = vscode.commands.registerCommand(this.commandId, () => {
            this.handleStatusBarCommand();
        });
        this.statusBarItem.command = this.commandId;
    }

    getCommand(): vscode.Disposable {
        return this.command;
    }

    getStatusBarItem(): vscode.StatusBarItem {
        return this.statusBarItem;
    }

    requestUpdate(): void {
        this.mlClient.getConnectedServers(this, this.updateStatusBarItem);
    }

    updateStatusBarItem(connectedServers: string[]): void {
        if (connectedServers.length > 0) {
            this.connectedServers = connectedServers;
            this.statusBarItem.text = 'Server connected';
        } else {
            this.connectedServers = null;
            this.statusBarItem.text = 'No servers connected';
        }
        this.statusBarItem.show();
    }

    handleStatusBarCommand(): void {
        if (this.connectedServers) {
            vscode.window.showInformationMessage(JSON.stringify(this.connectedServers));
        } else {
            vscode.window.showInformationMessage('Use a "MarkLogic: Connect" command to connect to a debug server');
        }
    }
}