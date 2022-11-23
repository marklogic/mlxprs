import * as vscode from 'vscode'
import * as mlLogs from 'marklogicLogs'
import * as ui from '../uiHelpers'
import { VirtualContentProvider } from '../virtualDocument'
import { LogDocument } from './logDocument'
import { CreateDecorations } from './logDecorations'
import { curry } from 'conditional-reduce'
import Query from './logQueries'

//Must match 'contributes > menus > when' clauses in `package.json`. e.g., `"when": "resourceScheme == mllogviewer"`
export const scheme = 'mllogviewer'

export function activate(context: vscode.ExtensionContext): void {

    console.debug('Registering Log Viewer')

    const decorator = CreateDecorations()

    const Q = new Query(context)

    //All updates to log documents happen through this provider. See `virtualDocument.ts`
    const contentProvider = new VirtualContentProvider<LogDocument>(LogDocument, decorator)

    //Maintain a list of URIs with tailing enabled to toggle button
    const tailingDocs = new Set<string>()
    vscode.commands.executeCommand('setContext', 'marklogic.tailingDocs', [...tailingDocs.values()])

    const logViewer = vscode.commands.registerCommand('extension.logs.newWindow', async () => {
        const connectionSettings = await getConnectionSettings(vscode.workspace.getConfiguration())
            .catch(error => { vscode.window.showInformationMessage(error) })

        if (!connectionSettings) {
            return
        }

        const filename =
            scheme + ':' +
            (
                connectionSettings.selectedHosts.length === 1 ?
                    connectionSettings.selectedHosts[0] :
                    `${connectionSettings.overrideHost}(${connectionSettings.selectedHosts.length})`
            ) + '_' +
            connectionSettings.logPort + '_'
            + connectionSettings.logType

        const uri = contentProvider.getAvailableUri(filename, '.mllog')
        const doc = await vscode.workspace.openTextDocument(uri)
        const logDoc = contentProvider.getDocument(uri)
        logDoc.connectionSettings = connectionSettings
        await vscode.window.showTextDocument(doc, { preview: false })
        await getLogsImp(logDoc)
    })
    const reloadLogs = vscode.commands.registerCommand('extension.logs.reload', async () => {
        if (!vscode.window.activeTextEditor) {
            return // no editor
        }
        const { document } = vscode.window.activeTextEditor
        if (document.uri.scheme !== scheme) {
            return // not my scheme
        }
        const logDocument = contentProvider.getDocument(document.uri)
        if (!logDocument) {
            return // can't find document
        }

        await getLogsImp(logDocument)
    })
    const updateLogs = vscode.commands.registerCommand('extension.logs.update', async () => {
        if (!vscode.window.activeTextEditor) {
            return // no editor
        }
        const { document } = vscode.window.activeTextEditor
        if (document.uri.scheme !== scheme) {
            return // not my scheme
        }
        const logDocument = contentProvider.getDocument(document.uri)
        if (!logDocument) {
            return // can't find document
        }

        await updateLogsImp(logDocument)
    })
    const startTailLogs = vscode.commands.registerCommand('extension.logs.startTail', async () => {
        if (!vscode.window.activeTextEditor) {
            return // no editor
        }
        const { document } = vscode.window.activeTextEditor
        if (document.uri.scheme !== scheme) {
            return // not my scheme
        }
        const logDocument = contentProvider.getDocument(document.uri)
        if (!logDocument) {
            return // can't find document
        }

        const tailFrequency = ui.parseTimeString(
            await vscode.window.showInputBox({
                prompt: 'Tail Frequency:',
                value: '5s',
                placeHolder: '#d #h #m #s'
            })
        )

        if (!tailFrequency) {
            vscode.window.showInformationMessage('Cancelled')
            return // tail frequency 0 or NaN
        }

        logDocument.tailTimer = setInterval(
            () => updateLogsImp(logDocument),
            tailFrequency * 1000
        )

        tailingDocs.add(document.uri.toString())
        vscode.commands.executeCommand('setContext', 'marklogic.tailingDocs', [...tailingDocs.values()])
    })

    const stopTailLogs = vscode.commands.registerCommand('extension.logs.stopTail', async () => {
        if (!vscode.window.activeTextEditor) {
            return // no editor
        }
        const { document } = vscode.window.activeTextEditor
        if (document.uri.scheme !== scheme) {
            return // not my scheme
        }
        const logDocument = contentProvider.getDocument(document.uri)
        if (!logDocument) {
            return // can't find document
        }

        clearInterval(logDocument.tailTimer)

        tailingDocs.delete(document.uri.toString())
        vscode.commands.executeCommand('setContext', 'marklogic.tailingDocs', [...tailingDocs.values()])
    })

    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider(scheme, contentProvider)
    )

    context.subscriptions.push(logViewer)
    context.subscriptions.push(reloadLogs)
    context.subscriptions.push(updateLogs)
    context.subscriptions.push(startTailLogs)
    context.subscriptions.push(stopTailLogs)

    async function getConnectionSettings(cfg: vscode.WorkspaceConfiguration): Promise<mlLogs.ConnectionSettings> {
        const overrideHost = await vscode.window.showInputBox({
            prompt: 'Connection Host:',
            value: cfg.get('marklogic.host'),
            placeHolder: 'Host to establish initial connection to cluster'
        })

        if (!overrideHost) {
            return Promise.reject('Cancelled')
        }

        const overridePort = parseInt(
            await vscode.window.showInputBox({
                prompt: 'Connection Port:',
                value: cfg.get('marklogic.port'),
                placeHolder: 'Port to establish initial connection to cluster'
            })
        )

        if (!overridePort) {
            return Promise.reject('Cancelled')
        }

        const defaultCredentials = (await vscode.window.showQuickPick<ui.BooleanPickItem>(
            ui.getBooleanPickItems(true),
            {
                canPickMany: false,
                placeHolder: 'Use Default Credentials?'
            }
        ))

        if (!defaultCredentials) {
            return Promise.reject('Cancelled')
        }

        const overrideUsername = await curry<Promise<string>>({
            true: async () => cfg.get('marklogic.username'),
            false: async () => vscode.window.showInputBox({
                prompt: 'MarkLogic Username:'
            })
        })(defaultCredentials.value.toString())

        if (!overrideUsername) {
            return Promise.reject('Cancelled - no Username')
        }

        const overridePassword = await curry<Promise<string>>({
            true: async () => cfg.get('marklogic.password'),
            false: async () => vscode.window.showInputBox({
                prompt: 'MarkLogic Password:',
                password: true
            })
        })(defaultCredentials.value.toString())

        if (!overridePassword) {
            return Promise.reject('Cancelled - no Password')
        }

        const logSelection = (await vscode.window.showQuickPick(
            ui.getPickItems<{type: mlLogs.LogType, server: 'DB'|'App'}>([
                { type: 'ErrorLog', server: 'DB' },
                { type: 'ErrorLog', server: 'App' },
                { type: 'AccessLog', server: 'App' },
                { type: 'RequestLog', server: 'App' }
            ],
            [
                'Error Log (Database)',
                'Error Log (App Server)',
                'Access Log',
                'Request Log'
            ]),
            {
                canPickMany: false,
                placeHolder: 'Log type to retrieve'
            }
        )).value

        if (!logSelection) {
            return Promise.reject('Cancelled')
        }

        let logPort = 0

        if (logSelection.server === 'App')
        {
            logPort = parseInt(
                await vscode.window.showInputBox({
                    prompt: 'Log Port:',
                    placeHolder: 'Port of appserver to retrive logs for'
                })
            )

            if (!logPort) {
                return Promise.reject('Cancelled')
            }
        }

        const connectionSettings: mlLogs.ConnectionSettings = {
            overrideHost: overrideHost,
            overridePort: overridePort,
            overrideUsername: overrideUsername,
            overridePassword: overridePassword,
            logType: logSelection.type,
            logPort: logPort,

            //Not implemented yet
            hostIsLoadbalancer: false,
            useBuiltinErrorParser: false,

            //Default for now so we can run a host query
            selectedHosts: []
        }

        //TODO: Reject promise if cannot connect to server
        const availableHosts: string[] = JSON.parse(
            await Q.getHosts(connectionSettings)
        )

        const selectedHosts = await vscode.window.showQuickPick(
            ui.getSelectedPickItems(availableHosts),
            {
                canPickMany: true,
                placeHolder: 'Host(s) of appserver to retrieve logs for'
            }
        )

        if (!selectedHosts || selectedHosts.length === 0) {
            return Promise.reject('Cancelled')
        }

        connectionSettings.selectedHosts = selectedHosts.map(selected => selected.value)

        return connectionSettings
    }

    async function getLogsImp(logDocument: LogDocument): Promise<void> {
        console.debug(`Clearing and getting new logs for URI ${logDocument.uri}`)
        logDocument.clearEntries()

        console.debug(`Hosts: ${logDocument.connectionSettings.selectedHosts}\nPort: ${logDocument.connectionSettings.logPort}`)

        const results = await Promise.all<{host: string, response: [mlLogs.LogResponse]}>(
            logDocument.connectionSettings.selectedHosts.map(
                async (host) => ({
                    host: host,
                    response: JSON.parse(await Q.getLogs(
                        logDocument.connectionSettings,
                        host
                    ))
                })
            )
        )
        console.debug(results)

        results.map(result =>
            result.response.map(log =>
                logDocument.processResults(result.host, log)
            )
        )

        logDocument.publishEntries(false)
    }

    //TODO: This needs logic to handle log rotations - right now, it is assumed you won't update a log after it rotates
    async function updateLogsImp(logDocument: LogDocument): Promise<void> {
        console.debug(`Updating logs for URI ${logDocument.uri}`)

        const hosts = [...logDocument.lastChecked.keys()]
        console.debug(hosts)

        const results = await Promise.all<{host: string, response: [mlLogs.LogResponse]}>(
            hosts.map(
                async (host: string) => ({
                    host: host,
                    response: JSON.parse(await Q.getLogs(
                        logDocument.connectionSettings,
                        host,
                        (logDocument.lastChecked.get(host) as mlLogs.LastCheckedSize).size
                    ))
                })
            )
        )
        console.debug(results)

        results.map(result =>
            result.response.map(log =>
                logDocument.processResults(result.host, log)
            )
        )

        logDocument.publishEntries(true)
    }
}
