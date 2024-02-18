import * as vscode from 'vscode';

import { ClientContext, newClientParams } from './marklogicClient';

export class MarkLogicDebugStatusTreeDataProvider implements vscode.TreeDataProvider<MarkLogicDebugStatus> {

    private _onDidChangeTreeData: vscode.EventEmitter<MarkLogicDebugStatus | undefined | void> =
        new vscode.EventEmitter<MarkLogicDebugStatus | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MarkLogicDebugStatus | undefined | void> =
        this._onDidChangeTreeData.event;

    private dbClientContext: ClientContext;
    private managePort: number;
    private: ClientContext;

    constructor() {
        this.configure();
    }

    onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
        if (event.affectsConfiguration('marklogic')) {
            this.dbClientContext.databaseClient.release();
            this.configure();
        }
    }

    private configure() {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        this.managePort = Number(cfg.get('marklogic.managePort')) || ClientContext.DEFAULT_MANAGE_PORT;
        this.dbClientContext = new ClientContext(newClientParams(cfg));
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    // implements
    getTreeItem(element: MarkLogicDebugStatus): vscode.TreeItem {
        return element;
    }

    // implements
    getChildren(element?: MarkLogicDebugStatus): Thenable<MarkLogicDebugStatus[]> {
        if (element) {
            if (element.label === 'Debug App Servers') {
                return this.buildDebugAppServerEntries();
            } else {
                return Promise.resolve([]);
            }
        } else {
            return Promise.resolve(this.buildTopLevelStatusEntries());
        }
    }

    private buildTopLevelStatusEntries(): MarkLogicDebugStatus[] {
        return [
            new MarkLogicDebugStatus(
                'Debug App Servers',
                '',
                '',
                vscode.TreeItemCollapsibleState.Collapsed,
                {
                    command: 'markLogicDebugStatusTree.refreshEntry',
                    title: '',
                    arguments: []
                }
            )
        ];
    }

    private async buildDebugAppServerEntries(): Promise<MarkLogicDebugStatus[]> {
        const connectedServerTreeElementList: MarkLogicDebugStatus[] = [];
        return this.dbClientContext.getConnectedServers(null, this.managePort, null)
            .then((connectedServers) => {
                if (connectedServers.length > 0) {
                    connectedServers.forEach(serverName => {
                        connectedServerTreeElementList.push(this.createSimpleTreeLeaf(serverName));
                    });
                } else {
                    connectedServerTreeElementList.push(this.createSimpleTreeLeaf('No Connected Servers'));
                }
                return connectedServerTreeElementList;
            });
    }

    private createSimpleTreeLeaf(label: string) {
        return new MarkLogicDebugStatus(
            label,
            '',
            '',
            vscode.TreeItemCollapsibleState.None,
            null
        );
    }
}

export class MarkLogicDebugStatus extends vscode.TreeItem {

    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
    }

    contextValue = 'TODO';
}