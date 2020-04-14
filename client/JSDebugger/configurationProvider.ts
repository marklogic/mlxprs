/*
 * Copyright (c) 2020 MarkLogic Corporation
 */

import * as vscode from 'vscode'
import {DebugConfiguration, WorkspaceFolder, CancellationToken, ProviderResult} from 'vscode'
import * as request from 'request-promise'
import * as querystring from 'querystring'
import * as fs from 'fs'


function buildUrl(hostname: string, endpointPath: string, ssl = true): string {
    const dbgPort = 8002
    const scheme: string = ssl ? 'https' : 'http'
    const url = `${scheme}://${hostname}:${dbgPort}${endpointPath}`
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
                config.path = '${file}'
            }
        }
        if (config.request === 'launch' && !config.path) {
            config.path = '${file}'
        }

        return this.resolveRemainingDebugConfiguration(folder, config)
    }

    /* helper function to resolve config parameters */
    private async resolveRemainingDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, _token?: CancellationToken): Promise<DebugConfiguration>  {
        // acquire extension settings
        const wcfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        config.hostname = String(wcfg.get('marklogic.host'))
        config.username = String(wcfg.get('marklogic.username'))
        config.password = String(wcfg.get('marklogic.password'))
        config.database = String(wcfg.get('marklogic.documentsDb'))
        config.modules = String(wcfg.get('marklogic.modulesDb'))
        config.root = String(wcfg.get('marklogic.modulesRoot'))
        config.ssl = Boolean(wcfg.get('marklogic.ssl'))

        if (config.ssl) config.pathToCa = String(wcfg.get('marklogic.pathToCa'))
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
                config.ssl, ca).then(resp => {
                config.database = resp.match('\r\n\r\n(.*[0-9])\r\n')[1] //better way of parsing?
            }).catch(e => {
                return vscode.window.showErrorMessage('Error getting database setting').then(() => {
                    return undefined
                })
            })
        }
        if (config.request == 'launch' && !config.modules.match(/^\d+$/)) {
            await this.resolveDatabasetoId(config.username, config.password, config.modules, config.hostname,
                config.ssl, ca).then(resp => {
                config.modules = resp.match('\r\n\r\n(.*[0-9])\r\n')[1] //better way of parsing?
            }).catch(() => {
                return vscode.window.showErrorMessage('Error getting modules database setting').then(() => {
                    return undefined
                })
            })
        }

        //query for paused requests
        if (config.request === 'attach' && config.username && config.password) {
            const resp = await this.getAvailableRequests(config.username,
                config.password, config.debugServerName, config.hostname, config.ssl, ca)
            const requests: string[] = JSON.parse(resp).requestIds
            const items = []
            for (let i=0; i< requests.length; i++) {
                try {
                    let resp = await this.getRequestInfo(
                        config.username, config.password, requests[i] as string,
                        config.debugServerName, config.hostname, config.ssl, ca)
                    resp = resp.match('\r\n\r\n(.*)\r\n')[1]
                    const requestText = JSON.parse(resp)['requestText']
                    const startTime = JSON.parse(resp)['startTime']

                    items.push({
                        label: requests[i],
                        description: 'module: ' + String(requestText),
                        detail: 'startTime: ' + String(startTime)
                    })
                } catch (e) {
                    items.push({
                        label: requests[i]
                    })
                }
            }
            const item = await vscode.window.showQuickPick(items, {placeHolder: 'Select the request to attach to' })
            if (!item) {
                return vscode.window.showErrorMessage('Request not selected').then(() => {
                    return undefined	// abort
                })
            }
            config.rid = item.label
        }

        return config
    }

    private async getAvailableRequests(username: string, password: string, debugServerName: string,
        hostname: string, ssl?: boolean, ca?: Buffer ): Promise<string> {
        const url = buildUrl(hostname, `/jsdbg/v1/paused-requests/${debugServerName}`, ssl)
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
        if (ca) options['agentOptions'] = {ca: ca}
        return request.get(url, options)
    }

    private async resolveDatabasetoId(username: string, password: string, database: string, hostname: string,
        ssl?: boolean, ca?: Buffer): Promise<string> {
        const url = buildUrl(hostname, '/v1/eval', ssl)
        const script=`xdmp.database("${database}")`
        const options: object = {
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
        if (ca) options['agentOptions'] = {ca: ca}
        return request.post(url, options)
    }

    private async getRequestInfo(username: string, password: string, requestId: string, debugServerName: string, hostname: string,
        ssl?: boolean, ca?: Buffer): Promise<string> {
        const url = buildUrl(hostname, '/v1/eval', ssl)
        const script=`xdmp.requestStatus(xdmp.host(),xdmp.server("${debugServerName}"),"${requestId}")`
        const options: object = {
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
        if (ca) options['agentOptions'] = {ca: ca}
        return request.post(url, options)
    }
}

export class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
        return executable
    }
}

export function _connectServer(servername: string ): void {
    const cfg = vscode.workspace.getConfiguration()
    const username: string = cfg.get('marklogic.username')
    const password: string = cfg.get('marklogic.password')
    const hostname: string = cfg.get('marklogic.host')
    const ssl = Boolean(cfg.get('marklogic.ssl'))
    const pathToCa = String(cfg.get('marklogic.pathToCa'))

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
    const url = buildUrl(hostname, `/jsdbg/v1/connect/${servername}`, ssl)
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
        options['agentOptions'] = {ca: fs.readFileSync(pathToCa)}

    request.post(url, options).then(() => {
        vscode.window.showInformationMessage('Debug server connected')
    }).catch(() => {
        vscode.window.showErrorMessage('Debug server connect failed')
    })
}

export function _disonnectServer(servername: string ): void {
    const cfg = vscode.workspace.getConfiguration()
    const username: string = cfg.get('marklogic.username')
    const password: string = cfg.get('marklogic.password')
    const hostname: string = cfg.get('marklogic.host')
    const ssl = Boolean(cfg.get('marklogic.ssl'))
    const pathToCa = String(cfg.get('marklogic.pathToCa'))

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
    const url = buildUrl(hostname, `/jsdbg/v1/disconnect/${servername}`, ssl)
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
        options['agentOptions'] = {ca: fs.readFileSync(pathToCa)}

    request.post(url, options).then(() => {
        vscode.window.showInformationMessage('Debug server disconnected')
    }).catch(() => {
        vscode.window.showErrorMessage('Debug server disconnect failed')
    })
}
