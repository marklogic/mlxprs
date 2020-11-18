'use strict'
import { MarklogicClient, sendJSQuery, sendSparql, sendXQuery } from './marklogicClient'
import { TextDocument, TextEdit, TextEditor, Uri, WorkspaceEdit, commands, window, workspace, WorkspaceConfiguration } from 'vscode'
import { QueryResultsContentProvider } from './queryResultsContentProvider'
import { contentType } from 'marklogic'

const FOPTIONS = { tabSize: 2, insertSpaces: true }
const FCOMMAND = 'vscode.executeFormatDocumentProvider'

async function formatResults(uri: Uri, retries = 0): Promise<boolean> {
    if (uri.path.endsWith('.text') || uri.path.endsWith('.nothing')) {
        return false
    }
    await new Promise(resolve => setTimeout(resolve, 60))
    return commands.executeCommand(FCOMMAND, uri, FOPTIONS)
        .then((edits: TextEdit[]) => {
            if (edits && edits.length) {
                console.debug(`${Date.now()} Got ${edits.length} edits...`)
                const formatEdit = new WorkspaceEdit()
                formatEdit.set(uri, edits)
                return workspace.applyEdit(formatEdit)
            } else if (retries > 100) {
                console.debug(`${Date.now()} Giving up on formatting.`)
                return false
            } else {
                console.debug(`${Date.now()} No edits yet. Wait a beat (${retries})...`)
                return formatResults(uri, retries + 1)
            }
        })
}

/**
 * Show the query results at a given URI
 * @param uri the response URI (where VS Code will call/show the query results)
 * @param editor results will be shown one column to the right
 * @returns Promise resolves to editor passed in, unchanged @async
 */
async function showFormattedResults(uri: Uri, editor: TextEditor): Promise<TextEditor> {
    return workspace.openTextDocument(uri)
        .then((doc: TextDocument) => {
            return window.showTextDocument(doc, editor.viewColumn + 1, true)
        })
        .then((editor: TextEditor) => {
            formatResults(uri)
            return editor
        })
}


export function editorJSQuery(
    db: MarklogicClient,
    actualQuery: string,
    uri: Uri,
    editor: TextEditor,
    provider: QueryResultsContentProvider): void
{
    sendJSQuery(db, actualQuery)
        .result(
            (fulfill: Record<string, any>[]) => {
                return provider.writeResponseToUri(uri, fulfill)
            },
            (error: Record<string, any>[]) => {
                return provider.handleError(uri, error)
            })
        .then(responseUri => showFormattedResults(responseUri, editor))
}


export function editorXQuery(
    db: MarklogicClient,
    actualQuery: string,
    uri: Uri,
    editor: TextEditor,
    provider: QueryResultsContentProvider,
    prefix: 'xdmp' | 'dbg' = 'xdmp'): void
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

export function buildSqlOptions(cfg: WorkspaceConfiguration): Array<string> {
    const resultsPref: string = cfg.get('marklogic.sql.results') || 'array'
    const olevel: 0 | 1 | 2 = cfg.get('marklogic.sql.optimize') || 1
    const options = [resultsPref, `optimize=${olevel}`]
    return options
}

export function editorSqlQuery(
    db: MarklogicClient,
    sqlQuery: string,
    uri: Uri,
    editor: TextEditor,
    cfg: WorkspaceConfiguration,
    provider: QueryResultsContentProvider): void
{
    const sqlOptions: Array<string> = buildSqlOptions(cfg)
    const actualQuery = 'xdmp.sql(sqlQuery, sqlOptions)'
    sendJSQuery(db, actualQuery, sqlQuery, sqlOptions)
        .result(
            (fulfill: Record<string, unknown>[]) => {
                return provider.writeResponseToUri(uri, [].concat(fulfill))
            },
            (error: Record<string, unknown>[]) => {
                return provider.handleError(uri, error)
            })
        .then(responseUri => showFormattedResults(responseUri, editor))
}


export function editorSparqlQuery(
    db: MarklogicClient,
    sparqlQuery: string,
    uri: Uri,
    editor: TextEditor,
    provider: QueryResultsContentProvider): void
{
    const contentType: contentType = workspace.getConfiguration().get('marklogic.sparqlContentType')
    sendSparql(db, sparqlQuery, contentType)
        .result(
            (fulfill: Record<string, unknown>) => {
                return provider.writeSparqlResponseToUri(uri, fulfill)
            },
            (error: Record<string, any>[]) => {
                return provider.handleError(uri, error)
            })
        .then((responseUri: Uri) => showFormattedResults(responseUri, editor))
}
