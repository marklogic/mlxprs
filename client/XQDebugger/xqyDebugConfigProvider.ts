import { DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder, CancellationToken, ProviderResult,
    window,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterDescriptor,
    DebugSession, QuickPickItem, QuickPickOptions,
    WorkspaceConfiguration, workspace } from 'vscode'
import { MarklogicClient, MlClientParameters, sendXQuery } from '../marklogicClient'
import { readFileSync } from 'fs'

const listServersQuery = `
! (map:new()
  => map:with("id", .)
  => map:with("name", xdmp:server-name(.))
  => map:with("port", xdmp:server-port(.)))
=> xdmp:to-json()`

const listStoppedRequests = `
for $rid in dbg:stopped()
let $status := dbg:status($rid)/*:request
let $server := xdmp:server-name($status/*:server-id)
let $rstatus := $status/*:request-status/fn:string()
let $dstatus := $status/*:debugging-status/fn:string()
return (json:object()
  => map:with('rid', $rid)
  => map:with('serverName', $server)
  => map:with('debugStatus', $dstatus)
  => map:with('requestStatus', $rstatus)
  )`

const doNotDebugThese = ['Admin', 'Manage', 'HealthCheck', 'App-Services']

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
    port?: number;
}

interface DebugStatusQueryResponse {
    rid: string;
    serverName: string;
    debugStatus: string;
    requestStatus: string;
}

export class XqyDebugConfigurationProvider implements DebugConfigurationProvider {
    private async getAvailableRequests(params: MlClientParameters): Promise<Array<DebugStatusQueryResponse>> {
        const client: MarklogicClient = new MarklogicClient(params)
        const resp = await sendXQuery(client, listStoppedRequests)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill.map(f => f.value as DebugStatusQueryResponse)
                },
                (error: Record<string, any>[]) => {
                    console.error(JSON.stringify(error))
                    return []
                })
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
            pathToCa: String(cfg.get('marklogic.pathToCa')),
            rejectUnauthorized: Boolean(cfg.get('marklogic.rejectUnauthorized'))
        })
        config.clientParams = clientParams

        if (config.request === 'attach' && !config.rid) {
            const rid: string = await this.getAvailableRequests(clientParams)
                .then((requests: Array<DebugStatusQueryResponse>) => {
                    if (requests.length) {
                        const qpRequests: QuickPickItem[] = requests.map((request: DebugStatusQueryResponse) => {
                            return {
                                label: request.rid,
                                description: `Request ${request.requestStatus} on ${request.serverName}`,
                                detail: request.debugStatus
                            } as QuickPickItem
                        })
                        return window.showQuickPick(qpRequests, placeholder)
                            .then((pickedRequest: QuickPickItem) => {
                                config.rid = pickedRequest.label
                                return config.rid
                            })
                    } else {
                        window.showWarningMessage(`No requests found to debug on ${clientParams.host}`)
                        return ''
                    }
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


    public static async chooseXqyServer(mlClient: MarklogicClient, intention: 'connect' | 'disconnect'): Promise<void> {
        const command = intention === 'connect' ? 'xdmp:servers()' : 'dbg:connected()'
        await sendXQuery(mlClient, `${command} ${listServersQuery}`)
            .result(
                (fulfill: Record<string, ServerQueryResponse>) => {
                    const servers: ServerQueryResponse[] = [].concat(fulfill[0]['value'] || [])
                    return servers
                        .filter((server: ServerQueryResponse) => ((server.port || 0) !== mlClient.params.port || intention === 'disconnect'))
                        .filter((server: ServerQueryResponse) => (!doNotDebugThese.includes(server.name) || intention === 'disconnect'))
                        .map((server: ServerQueryResponse) => {
                            return {
                                label: server.name,
                                description: server.id,
                                detail: `${server.name} on ${mlClient.params.host}:${server.port || '(none)'}`,
                            } as QuickPickItem
                        })
                },
                err => {
                    window.showErrorMessage(`couldn't get a list of servers: ${JSON.stringify(err)}`)
                    return []
                })
            .then((choices: QuickPickItem[]) => {
                if (choices.length) {
                    return window.showQuickPick(choices)
                        .then((choice: QuickPickItem) => {
                            return sendXQuery(mlClient, `dbg:${intention}(${choice.description})`)
                                .result(
                                    () => {
                                        window.showInformationMessage(`Successfully ${intention}ed ${choice.label} on ${mlClient.params.host}`)
                                    },
                                    (err) => {
                                        window.showErrorMessage(`Failed to connect to ${choice.label}: ${JSON.stringify(err.body.errorResponse.message)}`)
                                    })
                        })
                }
                window.showWarningMessage(`No stopped servers found on ${mlClient.params.host}`)
                return null
            })
    }
}

export class XqyDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable): ProviderResult<DebugAdapterDescriptor> {
        return executable
    }
}

