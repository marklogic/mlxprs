'use strict'
import { MarklogicVSClient } from './marklogicClient'
import { TextDocument, TextEdit, TextEditor, Uri, WorkspaceEdit, commands, window, workspace } from 'vscode'
import * as ml from 'marklogic'
import { QueryResultsContentProvider } from './queryResultsContentProvider'

const FOPTIONS = { tabSize: 2, insertSpaces: true }
const FCOMMAND = 'vscode.executeFormatDocumentProvider'

/**
 * Show the results of incoming query results (doc) in the (editor).
 * Try to format the results for readability.
 */
async function receiveDocument(doc: TextDocument, editor: TextEditor): Promise<TextEditor> {
    return new Promise(resolve => setTimeout(resolve, 60))
        .then(() => {
            const text: string = doc.getText()
            console.debug(`${doc.uri.toString()}: ${doc.isDirty} — ${text} \n Attempting formatting...`)
            return commands.executeCommand(FCOMMAND, doc.uri, FOPTIONS)
                .then((edits: TextEdit[]) => {
                    if (edits !== undefined) {
                        const formatEdit = new WorkspaceEdit()
                        formatEdit.set(doc.uri, edits)
                        return workspace.applyEdit(formatEdit)
                    } else {
                        console.warn('no edits!')
                        return false
                    }
                })
        })
        .then(() => {
            return window.showTextDocument(doc, editor.viewColumn + 1, true)
        })
}



export function _sendJSQuery(
    db: MarklogicVSClient,
    actualQuery: string,
    uri: Uri,
    editor: TextEditor,
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
            workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        },
        (error: Record<string, any>[]) => {
            const responseUri = provider.handleError(uri, error)
            workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        })
};


export function _sendXQuery(
    db: MarklogicVSClient,
    actualQuery: string,
    uri: Uri,
    editor: TextEditor,
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
            workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        },
        (error: Record<string, any>[]) => {
            const responseUri = provider.handleError(uri, error)
            workspace.openTextDocument(responseUri)
                .then(doc => receiveDocument(doc, editor))
        })
};
