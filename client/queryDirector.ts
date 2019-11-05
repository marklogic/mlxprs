'use strict'
import { MarklogicVSClient } from './marklogicClient'
import * as vscode from 'vscode'
import * as ml from 'marklogic'
import { QueryResultsContentProvider } from './queryResultsContentProvider'

const FOPTIONS = { tabSize: 2, insertSpaces: true }
const FCOMMAND = 'vscode.executeFormatDocumentProvider'

/**
 * Show the results of incoming query results (doc) in the (editor).
 * Try to format the results for readability.
 */
async function receiveDocument(doc: vscode.TextDocument, editor: vscode.TextEditor): Promise<vscode.TextEditor> {
    return new Promise(resolve => setTimeout(resolve, 60))
        .then(() => {
            const text: string = doc.getText()
            console.debug(`${doc.uri.toString()}: ${doc.isDirty} — ${text} \n Attempting formatting...`)
            return vscode.commands.executeCommand(FCOMMAND, doc.uri, FOPTIONS)
                .then((edits: vscode.TextEdit[]) => {
                    if (edits !== undefined) {
                        const formatEdit = new vscode.WorkspaceEdit()
                        formatEdit.set(doc.uri, edits)
                        return vscode.workspace.applyEdit(formatEdit)
                    } else {
                        console.warn('no edits!')
                        return false
                    }
                })
        })
        .then(() => {
            return vscode.window.showTextDocument(doc, editor.viewColumn + 1, true)
        })
}



export function _sendJSQuery(
    db: MarklogicVSClient,
    actualQuery: string,
    uri: vscode.Uri,
    editor: vscode.TextEditor,
    provider: QueryResultsContentProvider): void
{
    const query = 'xdmp.eval(actualQuery, {actualQuery: actualQuery},' +
        '{database: xdmp.database(contentDb), modules: xdmp.database(modulesDb)});'

    const extVars = {
        'actualQuery': actualQuery,
        'contentDb': db.params.contentDb,
        'modulesDb': db.params.modulesDb
    } as ml.Variables

    db.mldbClient.eval(query, extVars).result(
        (response: Record<string, any>[]) => {
            const responseUri = provider.writeResponseToUri(uri, response)
            vscode.workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        },
        (error: Record<string, any>[]) => {
            const responseUri = provider.handleError(uri, error)
            vscode.workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        })
};


export function _sendXQuery(
    db: MarklogicVSClient,
    actualQuery: string,
    uri: vscode.Uri,
    editor: vscode.TextEditor,
    provider: QueryResultsContentProvider): void
{
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
            const responseUri = provider.writeResponseToUri(uri, fulfill)
            vscode.workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        },
        (error: Record<string, any>[]) => {
            const responseUri = provider.handleError(uri, error)
            vscode.workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        })
};
