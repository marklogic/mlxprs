'use strict'
import * as path from 'path'
import * as vscode from 'vscode'
import * as ml from 'marklogic'
import { getDbClient, MarklogicVSClient } from './marklogicClient'
import { QueryResultsContentProvider } from './queryResultsContentProvider'
import { XmlFormattingEditProvider } from './xmlFormatting/Formatting'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient'

const MLDBCLIENT = 'mldbClient'

export function activate(context: vscode.ExtensionContext): void {
    context.globalState.update(MLDBCLIENT, null as ml.DatabaseClient)
    const provider = new QueryResultsContentProvider()

    function myFormattingOptions(): vscode.FormattingOptions {
        return { tabSize: 2, insertSpaces: true }
    }

    function applyEdits(edits: vscode.TextEdit[], doc: vscode.TextDocument): void {
        if (edits !== undefined) {
            const formatEdit = new vscode.WorkspaceEdit()
            formatEdit.set(doc.uri, edits)
            vscode.workspace.applyEdit(formatEdit)
        }
    }

    async function formatResults(doc: vscode.TextDocument): Promise<void> {
        const fOptions: vscode.FormattingOptions = myFormattingOptions()
        await new Promise(resolve => setTimeout(resolve, 10))
        const edits: vscode.TextEdit[] = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', doc.uri, fOptions)
        applyEdits(edits, doc)
    }

    /**
     * Show the results of incoming query results (doc) in the (editor).
     * Try to format the results for readability.
     */
    function receiveDocument(doc: vscode.TextDocument, editor: vscode.TextEditor): void {
        vscode.window.showTextDocument(doc, editor.viewColumn + 1, true)
            .then(() => {
                formatResults(doc)
            })
    }

    function _sendXQuery(db: MarklogicVSClient, actualQuery: string, uri: vscode.Uri, editor: vscode.TextEditor): void {
        const query =
            'xquery version "1.0-ml";' +
            'declare variable $actualQuery as xs:string external;' +
            'declare variable $documentsDb as xs:string external;' +
            'declare variable $modulesDb as xs:string external;' +
            'let $options := ' +
            '<options xmlns="xdmp:eval">' +
            '   <database>{xdmp:database($documentsDb)}</database>' +
            '   <modules>{xdmp:database($modulesDb)}</modules>' +
            '</options>' +
            'return xdmp:eval($actualQuery, (), $options)'
        const extVars = {
            'actualQuery': actualQuery,
            'documentsDb': db.params.contentDb,
            'modulesDb': db.params.modulesDb
        } as ml.Variables

        db.mldbClient.xqueryEval(query, extVars).result(
            (fulfill: Record<string, any>[]) => {
                const responseUri = provider.handleResponseToUri(uri, fulfill)
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            },
            (error: Record<string, any>) => {
                const responseUri = provider.handleError(uri, error)
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            })
    };

    function _sendJSQuery(db: MarklogicVSClient, actualQuery: string, uri: vscode.Uri, editor: vscode.TextEditor): void {
        const query = 'xdmp.eval(actualQuery, {actualQuery: actualQuery},' +
            '{database: xdmp.database(contentDb), modules: xdmp.database(modulesDb)});'

        const extVars = {
            'actualQuery': actualQuery,
            'contentDb': db.params.contentDb,
            'modulesDb': db.params.modulesDb
        } as ml.Variables

        db.mldbClient.eval(query, extVars).result(
            (response: Record<string, any>[]) => {
                const responseUri = provider.handleResponseToUri(uri, response)
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            },
            (error: Record<string, any>[]) => {
                const responseUri = provider.handleError(uri, error)
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            })
    };

    vscode.workspace.registerTextDocumentContentProvider(
        QueryResultsContentProvider.scheme, provider)

    const sendXQuery = vscode.commands.registerTextEditorCommand('extension.sendXQuery', editor => {
        const actualQuery = editor.document.getText()
        const cfg = vscode.workspace.getConfiguration()
        const client = getDbClient(actualQuery, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const qUri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        _sendXQuery(client, actualQuery, qUri, editor)
    })
    const sendJSQuery = vscode.commands.registerTextEditorCommand('extension.sendJSQuery', editor => {
        const actualQuery = editor.document.getText()
        const cfg = vscode.workspace.getConfiguration()
        const client = getDbClient(actualQuery, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const uri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        _sendJSQuery(client, actualQuery, uri, editor)
    })



    context.subscriptions.push(sendXQuery)
    context.subscriptions.push(sendJSQuery)
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: 'mlquery', language: 'xml' },
            new XmlFormattingEditProvider()
        )
    )
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: 'mlquery', language: 'xsl' },
            new XmlFormattingEditProvider()
        )
    )

    // XQuery hinting client below
    const serverModule = context.asAbsolutePath(path.join('server', 'dist', 'server.js'))
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6004'] }
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    }
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { language: 'xquery-ml', scheme: 'file' },
            { language: 'xquery-ml', scheme: 'untitled' },
            { language: 'javascript', scheme: 'file' },
            { language: 'javascript', scheme: 'untitled' }
        ],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    }
    const disposable = new LanguageClient('xQueryLanguageServer', 'XQuery Language Server', serverOptions, clientOptions).start()
    context.subscriptions.push(disposable)
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext): void {
    context.globalState.get<ml.DatabaseClient>(MLDBCLIENT).release()
    context.globalState.update(MLDBCLIENT, null)
}
