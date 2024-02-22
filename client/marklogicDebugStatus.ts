import * as vscode from 'vscode';

import { ClientContext } from './marklogicClient';
import { buildClientFactoryFromWorkspaceConfig } from './clientFactory';

export class MarkLogicDebugStatusTreeDataProvider implements vscode.TreeDataProvider<MarkLogicDebugStatus> {

    private _onDidChangeTreeData: vscode.EventEmitter<MarkLogicDebugStatus | undefined | void> =
        new vscode.EventEmitter<MarkLogicDebugStatus | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MarkLogicDebugStatus | undefined | void> =
        this._onDidChangeTreeData.event;

    private dbClientContext: ClientContext;
    private managePort: number;
    private manageBasePath: string;
    private: ClientContext;

    constructor() {
        this.configure();
    }

    onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
        if (event.affectsConfiguration('marklogic')) {
            this.dbClientContext.databaseClient.release();
            this.configure();
            this.refresh();
        }
    }

    private configure() {
        this.dbClientContext =
            buildClientFactoryFromWorkspaceConfig(vscode.workspace.getConfiguration())
                .newMarklogicManageClient();
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
        return this.dbClientContext.getConnectedServers(null, this.dbClientContext.params.port, this.dbClientContext.params.restBasePath, null)
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