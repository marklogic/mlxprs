'use strict'
import { MarklogicVSClient } from './marklogicClient'
import { TextDocument, TextEdit, TextEditor, Uri, WorkspaceEdit, commands, window, workspace } from 'vscode'
import * as ml from 'marklogic'
import { QueryResultsContentProvider } from './queryResultsContentProvider'

const FOPTIONS = { tabSize: 2, insertSpaces: true }
const FCOMMAND = 'vscode.executeFormatDocumentProvider'

/**
 * Show the query results at a given URI
 * @param uri the response URI (where VS Code will call/show the query results)
 * @param editor results will be shown one column to the right
 * @returns Promise resolves to editor passed in, unchanged @async
 */
async function showFormattedResults(uri: Uri, editor: TextEditor): Promise<TextEditor> {
    return workspace.openTextDocument(uri)
        .then((doc: TextDocument) => {
            const text: string = doc.getText()
            console.debug(`${uri.toString()}: ${doc.isDirty} — ${text} \n Attempting formatting...`)
            return commands.executeCommand(FCOMMAND, uri, FOPTIONS)
                .then((edits: TextEdit[]) => {
                    if (edits !== undefined) {
                        const formatEdit = new WorkspaceEdit()
                        formatEdit.set(uri, edits)
                        return workspace.applyEdit(formatEdit)
                    } else {
                        console.warn('no edits!')
                        return false
                    }
                })
                .then(() => window.showTextDocument(doc, editor.viewColumn + 1, true))
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
            return provider.writeResponseToUri(uri, response)
        },
        (error: Record<string, any>[]) => {
            return provider.handleError(uri, error)
        })
        .then(responseUri => showFormattedResults(responseUri, editor))
}


export function sendXQuery(
    db: MarklogicVSClient,
    actualQuery: string,
    prefix = 'xdmp'): ml.ResultProvider<Record<string, any>>
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
        `return ${prefix}:eval($actualQuery, (), $options)`
    const extVars = {
        'actualQuery': actualQuery,
        'documentsDb': db.params.contentDb,
        'modulesDb': db.params.modulesDb
    } as ml.Variables

    return db.mldbClient.xqueryEval(query, extVars)
}

export function editorXQuery(
    db: MarklogicVSClient,
    actualQuery: string,
    uri: Uri,
    editor: TextEditor,
    provider: QueryResultsContentProvider,
    prefix = 'xdmp'): void
{
    sendXQuery(db, actualQuery, prefix)
        .result(
            (fulfill: Record<string, any>[]) => {
                return provider.writeResponseToUri(uri, fulfill)
            },
            (error: Record<string, any>[]) => {
                return provider.handleError(uri, error)
            })
        .then(responseUri => showFormattedResults(responseUri, editor))
}
