/*
 * Copyright (c) 2020 MarkLogic Corporation
 */

import * as vscode from 'vscode'
import { DebugConfiguration, WorkspaceFolder, CancellationToken, ProviderResult } from 'vscode'
import * as request from 'request-promise'
import * as querystring from 'querystring'
import * as fs from 'fs'

const DEFAULT_MANAGE_PORT = 8002

function buildUrl(hostname: string, endpointPath: string, ssl = true, managePort = DEFAULT_MANAGE_PORT): string {
    const scheme: string = ssl ? 'https' : 'http'
    const url = `${scheme}://${hostname}:${managePort}${endpointPath}`
    return url
}

export class MLConfigurationProvider implements vscode.DebugConfigurationProvider {

    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, _token?: CancellationToken): ProviderResult<DebugConfiguration> {

        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor
            if (editor && editor.document.languageId === 'javascript') {
                config.type = 'ml-jsdebugger'
                config.name = 'Launch Debug Reques'
                config.request = 'launch'
                config.program = '${file}'
            }
        }

        // use active editor window as ad-hoc query if `program` not defined explicitly
        config.program = config.program || config.path
        if (!config.program) {
            const doc: vscode.TextDocument = vscode.window.activeTextEditor.document
            config.program = doc.fileName
            config.scheme = doc.uri.scheme
            config.queryText = doc.getText()
        }

        // deprecation warnings
        if (config.path && config.request === 'launch') {
            vscode.window.showWarningMessage('Use of \'path\' is deprecated in launch configurations. Please use \'program\'')
        }
        if (config.path && config.request === 'attach') {
            vscode.window.showWarningMessage('Use of \'path\' is deprecated in launch configurations. Please use \'root\'')
            config.root = config.root || config.path
        }

        return this.resolveRemainingDebugConfiguration(folder, config)
    }

    /* helper function to resolve config parameters */
    private async resolveRemainingDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, _token?: CancellationToken): Promise<DebugConfiguration> {
        // acquire extension settings
        const wcfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        config.hostname = String(wcfg.get('marklogic.host'))
        config.username = String(wcfg.get('marklogic.username'))
        config.password = String(wcfg.get('marklogic.password'))
        config.managePort = Number(wcfg.get('marklogic.managePort'))
        config.database = String(wcfg.get('marklogic.documentsDb'))
        config.modules = String(wcfg.get('marklogic.modulesDb'))
        config.mlModulesRoot = String(wcfg.get('marklogic.modulesRoot'))
        config.ssl = Boolean(wcfg.get('marklogic.ssl'))
        config.authType = String(wcfg.get('marklogic.authType'))
        config.rejectUnauthorized = Boolean(wcfg.get('marklogic.rejectUnauthorized'))

        if (config.ssl) config.pathToCa = String(wcfg.get('marklogic.pathToCa') || '')
        let ca: Buffer
        if (config.pathToCa)
            ca = fs.readFileSync(config.pathToCa)

        if (!config.hostname) {
            return vscode.window.showErrorMessage('Hostname is not provided').then(() => {
                return undefined
            })
        }
        if (!config.username) {
            return vscode.window.showErrorMessage('Username is not provided').then(() => {
                return undefined
            })
        }
        if (!config.password) {
            return vscode.window.showErrorMessage('Password is not provided').then(() => {
                return undefined
            })
        }
        if (config.request === 'attach' && !config.debugServerName) {
            return vscode.window.showErrorMessage('Debug server name is not provided').then(() => {
                return undefined
            })
        }
        if (config.request == 'launch' && !config.database.match(/^\d+$/)) {
            await this.resolveDatabasetoId(config.username, config.password, config.database, config.hostname,
                config.ssl, ca, config.rejectUnauthorized, config.managePort)
                .then(resp => {
                    config.database = resp.match('\r\n\r\n(.*[0-9])\r\n')[1] //better way of parsing?
                }).catch(e => {
                    vscode.window.showErrorMessage(`Error getting database id for database name, '${config.database}'`)
                    return null
                })
        }
        if (config.request == 'launch' && !config.modules.match(/^\d+$/)) {
            await this.resolveDatabasetoId(config.username, config.password, config.modules, config.hostname,
                config.ssl, ca, config.rejectUnauthorized, config.managePort)
                .then(resp => {
                    config.modules = resp.match('\r\n\r\n(.*[0-9])\r\n')[1] //better way of parsing?
                }).catch(() => {
                    return vscode.window.showErrorMessage('Error getting modules database setting').then(() => {
                        return undefined
                    })
                })
        }

        //query for paused requests
        if (config.request === 'attach' && config.username && config.password) {
            const resp = await this.getAvailableRequests(config.username, config.password, config.debugServerName,
                config.hostname, config.ssl, ca, config.rejectUnauthorized, config.managePort)
            const requests: string[] = JSON.parse(resp).requestIds
            const pausedRequests = []
            for (let i = 0; i < requests.length; i++) {
                try {
                    let resp = await this.getRequestInfo(
                        config.username, config.password, requests[i] as string, config.debugServerName,
                        config.hostname, config.ssl, ca, config.managePort)
                    resp = resp.match('\r\n\r\n(.*)\r\n')[1]
                    const requestText = JSON.parse(resp)['requestText']
                    const startTime = JSON.parse(resp)['startTime']

                    pausedRequests.push({
                        label: requests[i],
                        description: 'module: ' + String(requestText),
                        detail: 'startTime: ' + String(startTime)
                    } as vscode.QuickPickItem)
                } catch (e) {
                    pausedRequests.push({
                        label: requests[i]
                    })
                }
            }
            if (pausedRequests.length > 0) {
                const item = await vscode.window.showQuickPick(pausedRequests, { placeHolder: 'Select the request to attach to' })
                if (!item) {
                    return vscode.window.showErrorMessage('Request not selected').then(() => {
                        return undefined	// abort
                    })
                }
                config.rid = item.label
            } else {
                vscode.window.showErrorMessage('No paused requests found on server')
                return undefined
            }
        }

        return config
    }

    private async getAvailableRequests(
        username: string, password: string, debugServerName: string, hostname: string, ssl?: boolean,
        ca?: Buffer, rejectUnauthorized = true, managePort = DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = buildUrl(hostname, `/jsdbg/v1/paused-requests/${debugServerName}`, ssl, managePort)
        const options = {
            headers: {
                'X-Error-Accept': ' application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            }
        }
        if (ca) options['agentOptions'] = { ca: ca }
        options['rejectUnauthorized'] = rejectUnauthorized
        return request.get(url, options)
    }

    private async resolveDatabasetoId(username: string, password: string, database: string, hostname: string,
        ssl?: boolean, ca?: Buffer, rejectUnauthorized = true, managePort = DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = buildUrl(hostname, '/v1/eval', ssl, managePort)
        const script = `xdmp.database("${database}")`
        const options: Record<string, unknown> = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'Accept': 'multipart/mixed',
                'X-Error-Accept': ' application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            },
            body: `javascript=${querystring.escape(script)}`
        }
        if (ca) options['agentOptions'] = { ca: ca }
        options['rejectUnauthorized'] = rejectUnauthorized
        return request.post(url, options)
    }

    private async getRequestInfo(username: string, password: string, requestId: string, debugServerName: string, hostname: string,
        ssl?: boolean, ca?: Buffer, rejectUnauthorized = true, managePort = DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = buildUrl(hostname, '/v1/eval', ssl, managePort)
        const script = `xdmp.requestStatus(xdmp.host(),xdmp.server("${debugServerName}"),"${requestId}")`
        const options: Record<string, unknown> = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'Accept': 'multipart/mixed',
                'X-Error-Accept': ' application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            },
            body: `javascript=${querystring.escape(script)}`
        }
        if (ca) options['agentOptions'] = { ca: ca }
        options['rejectUnauthorized'] = rejectUnauthorized
        return request.post(url, options)
    }
}

export class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
        return executable
    }
}

export function _connectServer(servername: string): void {
    const cfg = vscode.workspace.getConfiguration()
    const username: string = cfg.get('marklogic.username')
    const password: string = cfg.get('marklogic.password')
    const hostname: string = cfg.get('marklogic.host')
    const managePort: number = cfg.get('marklogic.managePort')
    const ssl = Boolean(cfg.get('marklogic.ssl'))
    const pathToCa = String(cfg.get('marklogic.pathToCa') || '')
    const rejectUnauthorized = Boolean(cfg.get('marklogic.rejectUnauthorized'))

    if (!hostname) {
        vscode.window.showErrorMessage('Hostname is not provided')
        return
    }
    if (!username) {
        vscode.window.showErrorMessage('Username is not provided')
        return
    }
    if (!password) {
        vscode.window.showErrorMessage('Password is not provided')
        return
    }
    const url = buildUrl(hostname, `/jsdbg/v1/connect/${servername}`, ssl, managePort)
    const options = {
        headers: {
            'Content-type': 'application/x-www-form-urlencoded',
            'X-Error-Accept': 'application/json'
        },
        auth: {
            user: username,
            pass: password,
            'sendImmediately': false
        }
    }
    if (pathToCa !== '')
        options['agentOptions'] = { ca: fs.readFileSync(pathToCa) }
    options['rejectUnauthorized'] = rejectUnauthorized

    request.post(url, options).then(() => {
        vscode.window.showInformationMessage('Debug server connected')
    }).catch(err => {
        vscode.window.showErrorMessage('Debug server connect failed: ' + JSON.stringify(err))
    })
}

export function _disconnectServer(servername: string): void {
    const cfg = vscode.workspace.getConfiguration()
    const username: string = cfg.get('marklogic.username')
    const password: string = cfg.get('marklogic.password')
    const hostname: string = cfg.get('marklogic.host')
    const managePort: number = cfg.get('marklogic.managePort')
    const ssl = Boolean(cfg.get('marklogic.ssl'))
    const pathToCa = String(cfg.get('marklogic.pathToCa') || '')
    const rejectUnauthorized = Boolean(cfg.get('marklogic.rejectUnauthorized'))

    if (!hostname) {
        vscode.window.showErrorMessage('Hostname is not provided')
        return
    }
    if (!username) {
        vscode.window.showErrorMessage('Username is not provided')
        return
    }
    if (!password) {
        vscode.window.showErrorMessage('Password is not provided')
        return
    }
    const url = buildUrl(hostname, `/jsdbg/v1/disconnect/${servername}`, ssl, managePort)
    const options = {
        headers: {
            'Content-type': 'application/x-www-form-urlencoded',
            'X-Error-Accept': 'application/json'
        },
        auth: {
            user: username,
            pass: password,
            'sendImmediately': false
        }
    }
    if (pathToCa !== '')
        options['agentOptions'] = { ca: fs.readFileSync(pathToCa) }
    options['rejectUnauthorized'] = rejectUnauthorized

    request.post(url, options).then(() => {
        vscode.window.showInformationMessage('Debug server disconnected')
    }).catch(() => {
        vscode.window.showErrorMessage('Debug server disconnect failed')
    })
}
