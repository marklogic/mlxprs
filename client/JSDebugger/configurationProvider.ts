/*
 * Copyright (c) 2020 MarkLogic Corporation
 */

import * as vscode from 'vscode'
import {DebugConfiguration,WorkspaceFolder, CancellationToken, ProviderResult} from 'vscode'
import * as request from 'request-promise'

export class MLConfigurationProvider implements vscode.DebugConfigurationProvider {

    /**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
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
        if (config.request === 'launch') {
            config.path = '${file}'
        }

        return this.resolveRemainingDebugConfiguration(folder,config)
    }

    private async resolveRemainingDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration> {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        if(!config.hostname) {
            if (cfg.get('marklogic.host')) {
                config.hostname = String(cfg.get('marklogic.host'))
            } else {
                const hostname = await vscode.window.showInputBox({
                    placeHolder: 'Please enter your hostname',
                    value: ''
                })
                if(!hostname) {
                    return vscode.window.showErrorMessage('Hostname is not provided').then(_ => {
                        return undefined	// abort
                    })
                }
                config.hostname = hostname
            }
        }
        if(!config.servername && config.request === 'attach') {
            const servername = await vscode.window.showInputBox({
                placeHolder: 'Please enter your servername',
                value: ''
            })
            if(!servername) {
                return vscode.window.showErrorMessage('Servername is not provided').then(_ => {
                    return undefined	// abort
                })
            }
            config.servername = servername
        }
        if (!config.username) {
            if (cfg.get('marklogic.username')) {
                config.username = String(cfg.get('marklogic.username'))
            } else {
                const username = await vscode.window.showInputBox({
                    placeHolder: 'Please enter your username',
                    value: ''
                })
                if(!username) {
                    return vscode.window.showErrorMessage('Username is not provided').then(_ => {
                        return undefined	// abort
                    })
                }
                config.username = username
            }
        }
        if (!config.password){
            if (cfg.get('marklogic.password')) {
                config.password = String(cfg.get('marklogic.password'))
            } else {
                const password = await vscode.window.showInputBox({
                    placeHolder: 'Please enter your password',
                    value: ''
                })
                if(!password) {
                    return vscode.window.showErrorMessage('Password is not provided').then(_ => {
                        return undefined	// abort
                    })
                }
                config.password = password
            }
        }

        if(config.username && config.password && config.request === 'attach'){
            const resp = await this.getAvailableRequests(config.username, config.password, config.servername, config.hostname)
            const requests: any = JSON.parse(resp).requestIds
            const items: any[] = []
            requests.forEach((x: any) => {
                items.push({
                    label:x,
                    // description:"module: " + String(x.requestText),
                    // detail:"startTime: " + String(x.startTime)
                })
            })
            const item = await vscode.window.showQuickPick(
                items,
                { placeHolder: 'Select the request to attach to' })
            if (!item) {
                return vscode.window.showErrorMessage('Request not selected').then(() => {
                    return undefined	// abort
                })
            }
            config.rid = item.label
        }

        return config
    }

    private async getAvailableRequests(username: string, password: string, servername: string, hostname: string): Promise<any> {
        const url = `http://${hostname}:8002/jsdbg/v1/paused-requests/${servername}`
        const options = {
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            }
        }
        return request.get(url, options)
    }
}

export class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): ProviderResult<vscode.DebugAdapterDescriptor> {
        return executable
    }
}
