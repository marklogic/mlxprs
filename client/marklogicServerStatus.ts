import * as vscode from 'vscode';

import { ClientContext, PropertiesResponse, ResourceResponse } from './marklogicClient';
import { buildClientFactoryFromWorkspaceConfig } from './clientFactory';

export class MarkLogicServerStatusTreeDataProvider implements vscode.TreeDataProvider<MarkLogicServerStatus> {

    private _onDidChangeTreeData: vscode.EventEmitter<MarkLogicServerStatus | undefined | void> =
        new vscode.EventEmitter<MarkLogicServerStatus | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<MarkLogicServerStatus | undefined | void> =
        this._onDidChangeTreeData.event;

    private dbClientContext: ClientContext;
    private dbManageClientContext: ClientContext;
    private allResources: ResourceResponse;
    private allProperties: PropertiesResponse;
    private getAllResourcesPromise: Promise<ResourceResponse>;
    private getAllPropertiesPromise: Promise<PropertiesResponse>;

    constructor() {
        this.configure();
    }

    onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
        if (event.affectsConfiguration('marklogic')) {
            if (this.dbClientContext.databaseClient) {
                this.dbClientContext.databaseClient.release();
            }
            if (this.dbManageClientContext.databaseClient) {
                this.dbManageClientContext.databaseClient.release();
            }
            this.configure();
        }
    }

    private configure() {
        const clientFactory = buildClientFactoryFromWorkspaceConfig(vscode.workspace.getConfiguration());
        this.dbClientContext = clientFactory.newMarklogicRestClient();
        this.dbManageClientContext = clientFactory.newMarklogicManageClient();

        this.getAllResourcesPromise = this.dbManageClientContext.getAllResources();
        this.getAllPropertiesPromise = null;
    }

    refresh(): void {
        this.getAllResourcesPromise = this.dbManageClientContext.getAllResources();
        this.getAllPropertiesPromise = null;
        this._onDidChangeTreeData.fire();
    }

    // implements
    getTreeItem(element: MarkLogicServerStatus): vscode.TreeItem {
        return element;
    }

    openMarkLogicAssetPage(url: string): void {
        vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(url));
    }

    // implements
    async getChildren(element?: MarkLogicServerStatus): Promise<MarkLogicServerStatus[]> {
        return this.getAllResourcesPromise
            .then((resourceResponse) => {
                this.allResources = resourceResponse;
                if (!this.getAllPropertiesPromise) {
                    this.getAllPropertiesPromise = this.dbManageClientContext.getAllProperties();
                }
                return this.getAllPropertiesPromise;
            })
            .then((propertiesResponse) => {
                this.allProperties = propertiesResponse;
                if (element) {
                    if (element.label === 'Server Configuration') {
                        return this.buildServerEntries();
                    } else if (element.label === 'Databases') {
                        return this.buildDatabaseEntries();
                    } else if (element.label === 'App-Servers') {
                        return this.buildAppServerEntries();
                    } else {
                        return [];
                    }
                } else {
                    return this.buildTopLevelStatusEntries();
                }
            });
    }

    private buildTopLevelStatusEntries(): MarkLogicServerStatus[] {
        return [
            new MarkLogicServerStatus(
                'Server Configuration',
                '',
                `(${this.dbClientContext.params.host})`,
                vscode.TreeItemCollapsibleState.Collapsed,
                null
            )
        ];
    }

    private buildServerEntries(): MarkLogicServerStatus[] {
        return [
            this.createSimpleTreeParentWithRefresh('Databases'),
            this.createSimpleTreeParentWithRefresh('App-Servers')
        ];
    }

    private buildDatabaseEntries(): MarkLogicServerStatus[] {
        const databaseConfigList = this.allResources.config[0].database;
        const databaseList: MarkLogicServerStatus[] = [];
        databaseConfigList.forEach(databaseItem => {
            const databasePath = `/database-admin.xqy?section=database&database=${databaseItem.id}`;
            const urlBase =
                this.dbClientContext.buildUrlBase(this.dbClientContext.params.adminPort, this.dbClientContext.params.adminBasePath);
            const url = `${urlBase}${databasePath}`;
            databaseList.push(
                new MarkLogicServerStatus(
                    databaseItem.name,
                    '',
                    '',
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'extension.callOpenMarkLogicAssetPage',
                        title: '',
                        arguments: [url]
                    }
                )
            );
        });
        return databaseList.sort(MarkLogicServerStatus.MarkLogicServerStatusSorter);
    }

    private buildAppServerEntries(): MarkLogicServerStatus[] {
        const appServerConfigList = this.allResources.config[0].server;
        const appServerPropertiesList = this.allProperties['config'][0]['server'];
        const appServerList: MarkLogicServerStatus[] = [];
        appServerConfigList.forEach(appServer => {
            const appServerPath = `/http-server-admin.xqy?http-server=${appServer.id}`;
            const urlBase =
                this.dbClientContext.buildUrlBase(this.dbClientContext.params.adminPort, this.dbClientContext.params.adminBasePath);
            const url = `${urlBase}${appServerPath}`;
            const appServerProperties = appServerPropertiesList
                .filter((properties) => properties['server-name'] === appServer.name)[0];
            appServerList.push(
                new MarkLogicServerStatus(
                    appServer.name,
                    '',
                    `(${appServerProperties.port})`,
                    vscode.TreeItemCollapsibleState.None,
                    {
                        command: 'extension.callOpenMarkLogicAssetPage',
                        title: '',
                        arguments: [url]
                    }
                )
            );
        });
        return appServerList.sort(MarkLogicServerStatus.MarkLogicServerStatusSorter);
    }

    private createSimpleTreeParentWithRefresh(label: string) {
        return new MarkLogicServerStatus(
            label,
            '',
            '',
            vscode.TreeItemCollapsibleState.Collapsed,
            {
                command: 'markLogicStatusTree.refreshEntry',
                title: '',
                arguments: []
            }
        );
    }
}

export class MarkLogicServerStatus extends vscode.TreeItem {

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

    static MarkLogicServerStatusSorter(a: MarkLogicServerStatus, b: MarkLogicServerStatus): number {
        return (a.label.toUpperCase() > b.label.toUpperCase()) ? 1 : ((b.label.toUpperCase() > a.label.toUpperCase()) ? -1 : 0);
    }
}