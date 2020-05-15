import { DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder, CancellationToken, ProviderResult,
    window,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterDescriptor,
    DebugSession, QuickPickItem, QuickPickOptions,
    WorkspaceConfiguration, workspace, Memento } from 'vscode'
import { MarklogicClient, MlClientParameters, sendXQuery } from '../marklogicClient'
import { readFileSync } from 'fs'
import { cascadeOverrideClient } from '../vscQueryParameterTools'

const XQY = 'xqy'
const listServersQuery = `
    xdmp:servers()
    ! (map:new() => map:with("id", .) => map:with("name", xdmp:server-name(.)))
    => xdmp:to-json()`

export class XqyDebugConfiguration implements DebugConfiguration {
    [key: string]: any
    type: string
    name: string
    request: string
    rid: string

    path?: string
    program: string
    query: string

    stopOnEntry: boolean

    clientParams: MlClientParameters
}

const placeholder: QuickPickOptions = {
    placeHolder: 'Select the request to attach'
}

interface ServerQueryResponse {
    name: string;
    id: string;
}


export class XqyDebugConfigurationProvider implements DebugConfigurationProvider {
    private async getAvailableRequests(params: MlClientParameters): Promise<Array<string>> {
        const client: MarklogicClient = new MarklogicClient(params)
        const resp = await sendXQuery(client, 'dbg:stopped()')
            .result(
                (fulfill: Record<string, any>[]) => {
                    return [].concat(fulfill[0]['value'] || [])
                },
                (error: Record<string, any>[]) => {
                    console.error(JSON.stringify(error))
                    return []
                }
            )
        return resp
    }

    private async resolveRemainingDebugConfiguration(folder: WorkspaceFolder | undefined, config: XqyDebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration> {
        const cfg: WorkspaceConfiguration = workspace.getConfiguration()
        const clientParams: MlClientParameters = new MlClientParameters({
            host: String(cfg.get('marklogic.host')),
            port: Number(cfg.get('marklogic.port')),
            user: String(cfg.get('marklogic.username')),
            pwd: String(cfg.get('marklogic.password')),
            contentDb: String(cfg.get('marklogic.documentsDb')),
            modulesDb: String(cfg.get('marklogic.modulesDb')),
            authType: String(cfg.get('marklogic.authType')),
            ssl: Boolean(cfg.get('marklogic.ssl')),
            pathToCa: String(cfg.get('marklogic.pathToCa'))
        })
        config.clientParams = clientParams

        // TODO: for attaching to existing requests
        if (config.request === 'attach') {
            const rid: string = await this.getAvailableRequests(clientParams)
                .then((requests: Array<string>) => {
                    const qpRequests: QuickPickItem[] = requests.map((request: string) => {
                        return {
                            label: request,
                            description: `Stopped request on ${clientParams.host}:${clientParams.port}`,
                            detail: `${clientParams.contentDb} database, ${clientParams.modulesDb} modules `
                        } as QuickPickItem
                    })
                    return window.showQuickPick(qpRequests, placeholder)
                        .then((pickedRequest: QuickPickItem) => {
                            config.rid = pickedRequest.label
                            return config.rid
                        })
                })
            config.rid = rid
        }
        return config
    }

    /**
     * @override
     */
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: XqyDebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        if (!config.type && !config.request && !config.name) {
            const editor = window.activeTextEditor
            if (editor && editor.document.languageId === 'xquery-ml') {
                config.type = 'xquery-ml'
                config.name = 'Launch XQY Debug Request'
                config.request = 'launch'
                config.program = '${file}'
                config.stopOnEntry = true
            }
        }

        if (!config.program) {
            config.program = window.activeTextEditor.document.fileName
            config.query = window.activeTextEditor.document.getText()
        } else {
            config.query = readFileSync(config.program).toString()
        }

        return this.resolveRemainingDebugConfiguration(folder, config)
    }


    public static async chooseXqyServer(client: MarklogicClient): Promise<void> {
        await sendXQuery(client, listServersQuery)
            .result(
                (fulfill: Record<string, any>) => {
                    const servers: ServerQueryResponse[] = [].concat(fulfill[0]['value'] || [])
                    return servers.map((server: ServerQueryResponse) => {
                        return {
                            label: server.name,
                            description: server.id,
                            detail: `${server.name} on ${client.params.host}:${client.params.port}`
                        } as QuickPickItem
                    })
                },
                err => {
                    window.showErrorMessage(`couldn't get a list of active servers: ${err}`)
                    return []
                }
            ).then((choices: QuickPickItem[]) => {
                return window.showQuickPick(choices)
            }).then((choice: QuickPickItem) => {
                return sendXQuery(client, `dbg:connect(${choice.description})`)
                    .result(
                        () => {
                            window.showInformationMessage(`Connected to ${choice.label} on ${client.params.host}`)
                        },
                        (err) => {
                            window.showErrorMessage(`Failed to connect to ${choice.label}: ${JSON.stringify(err)}`)
                        }
                    )
            })
    }
}

export class XqyDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable): ProviderResult<DebugAdapterDescriptor> {
        return executable
    }
}

