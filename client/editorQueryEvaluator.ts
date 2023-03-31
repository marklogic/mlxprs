'use strict';
import { ExtensionContext, TextDocument, TextEdit, TextEditor, Uri, WorkspaceEdit,
    commands, window, workspace, WorkspaceConfiguration } from 'vscode';
import { cascadeOverrideClient } from './vscQueryParameterTools';
import { ClientContext, sendJSQuery, sendSparql, sendXQuery, sendRows } from './marklogicClient';
import { ClientResponseProvider } from './clientResponseProvider';
import { contentType, RowsResponse } from 'marklogic';
import * as ml from 'marklogic';

export enum EditorQueryType {
    JS,
    XQY,
    SPARQL,
    SQL,
    ROWS
}

export class EditorQueryEvaluator {
    private static FOPTIONS = { tabSize: 2, insertSpaces: true };
    private static FCOMMAND = 'vscode.executeFormatDocumentProvider';
    private static SJS = 'sjs';
    private static XQY = 'xqy';

    private extensionContext: ExtensionContext;
    private provider: ClientResponseProvider;

    public constructor(context: ExtensionContext, provider: ClientResponseProvider) {
        this.extensionContext = context;
        this.provider = provider;
    }

    // Exported only for testing purposes
    public static getQueryFromEditor(editor: TextEditor): string {
        const selection = editor.selection;
        const selectionText = editor.document.getText(selection);
        let query: string = null;
        if (selectionText) {
            query = selectionText;
        } else {
            query = editor.document.getText();
        }
        return query;
    }

    public editorQuery(
        editorQueryType: EditorQueryType, editor: TextEditor, rowsResponseFormat?: ml.RowsResponseFormat
    ): void {
        const query = EditorQueryEvaluator.getQueryFromEditor(editor);
        const cfg: WorkspaceConfiguration = workspace.getConfiguration();
        let language = EditorQueryEvaluator.SJS;
        if (editorQueryType === EditorQueryType.XQY) {
            language = EditorQueryEvaluator.XQY;
        }
        const dbClientContext: ClientContext = cascadeOverrideClient(query, language, cfg, this.extensionContext.globalState);
        const host = dbClientContext.params.host;
        const port = dbClientContext.params.port;
        const resultsEditorTabIdentifier = ClientResponseProvider.encodeLocation(editor.document.uri, host, port);

        switch (editorQueryType) {
        case EditorQueryType.XQY:
            this.editorXQuery(dbClientContext, query, resultsEditorTabIdentifier, editor);
            break;
        case EditorQueryType.JS:
            this.editorJSQuery(dbClientContext, query, resultsEditorTabIdentifier, editor);
            break;
        case EditorQueryType.SPARQL:
            this.editorSparqlQuery(dbClientContext, query, resultsEditorTabIdentifier, editor);
            break;
        case EditorQueryType.SQL:
            this.editorSqlQuery(dbClientContext, query, resultsEditorTabIdentifier, editor, cfg);
            break;
        case EditorQueryType.ROWS:
            this.editorRowsQuery(dbClientContext, query, resultsEditorTabIdentifier, editor, rowsResponseFormat);
            break;
        }
    }

    private editorJSQuery(
        dbClientContext: ClientContext,
        query: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor
    ): void {
        sendJSQuery(dbClientContext, query)
            .result(
                (fulfill: Record<string, unknown>[]) => {
                    return this.provider.writeResponseToUri(resultsEditorTabIdentifier, fulfill);
                },
                (error: Record<string, unknown>[]) => {
                    return this.provider.handleError(resultsEditorTabIdentifier, error);
                })
            .then(resultsEditorTabIdentifier => EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor));
    }

    private editorXQuery(
        dbClientContext: ClientContext,
        query: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor,
        prefix: 'xdmp' | 'dbg' = 'xdmp'
    ): void {
        sendXQuery(dbClientContext, query, prefix)
            .result(
                (fulfill: Record<string, unknown>[]) => {
                    return this.provider.writeResponseToUri(resultsEditorTabIdentifier, fulfill);
                },
                (error: Record<string, unknown>[]) => {
                    return this.provider.handleError(resultsEditorTabIdentifier, error);
                })
            .then(resultsEditorTabIdentifier => EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor));
    }

    private buildSqlOptions(cfg: WorkspaceConfiguration): Array<string> {
        const resultsPref: string = cfg.get('marklogic.sql.results') || 'array';
        const olevel: 0 | 1 | 2 = cfg.get('marklogic.sql.optimize') || 1;
        const options = [resultsPref, `optimize=${olevel}`];
        return options;
    }

    private editorSqlQuery(
        dbClientContext: ClientContext,
        sqlQuery: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor,
        cfg: WorkspaceConfiguration
    ): void {
        const sqlOptions: Array<string> = this.buildSqlOptions(cfg);
        const query = 'xdmp.sql(sqlQuery, sqlOptions)';
        sendJSQuery(dbClientContext, query, sqlQuery, sqlOptions)
            .result(
                (fulfill: Record<string, unknown>[]) => {
                    return this.provider.writeResponseToUri(resultsEditorTabIdentifier, [].concat(fulfill));
                },
                (error: Record<string, unknown>[]) => {
                    return this.provider.handleError(resultsEditorTabIdentifier, error);
                })
            .then(resultsEditorTabIdentifier => EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor));
    }

    private editorSparqlQuery(
        dbClientContext: ClientContext,
        sparqlQuery: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor
    ): void {
        const contentType: contentType = workspace.getConfiguration().get('marklogic.sparqlContentType');
        sendSparql(dbClientContext, sparqlQuery, contentType)
            .result(
                (fulfill: Record<string, unknown>) => {
                    return this.provider.writeSparqlResponseToUri(resultsEditorTabIdentifier, fulfill);
                },
                (error: Record<string, unknown>[]) => {
                    return this.provider.handleError(resultsEditorTabIdentifier, error);
                })
            .then((resultsEditorTabIdentifier: Uri) => EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor));
    }

    private editorRowsQuery(
        dbClientContext: ClientContext,
        query: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor,
        resultFormat: ml.RowsResponseFormat
    ): void {
        sendRows(dbClientContext, query, resultFormat)
            .then(
                (response: RowsResponse) => {
                    if (response.preRequestError) {
                        return this.provider.handleError(resultsEditorTabIdentifier, response.preRequestError);
                    } else {
                        return this.provider.writeRowsResponseToUri(resultsEditorTabIdentifier, response, resultFormat);
                    }
                }
            )
            .catch(err => {
                return this.provider.handleError(resultsEditorTabIdentifier, err);
            })
            .then((resultsEditorTabIdentifier: Uri) => EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor));
    }

    private static async formatResults(resultsEditorTabIdentifier: Uri, retries = 0): Promise<boolean> {
        if (resultsEditorTabIdentifier.path.endsWith('.text') || resultsEditorTabIdentifier.path.endsWith('.nothing')) {
            return false;
        }
        await new Promise(resolve => setTimeout(resolve, 60));
        return commands.executeCommand(EditorQueryEvaluator.FCOMMAND, resultsEditorTabIdentifier, EditorQueryEvaluator.FOPTIONS)
            .then(
                (edits: TextEdit[]) => {
                    if (edits && edits.length) {
                        console.debug(`${Date.now()} Got ${edits.length} edits...`);
                        const formatEdit = new WorkspaceEdit();
                        formatEdit.set(resultsEditorTabIdentifier, edits);
                        return workspace.applyEdit(formatEdit);
                    } else if (retries > 100) {
                        console.debug(`${Date.now()} Giving up on formatting.`);
                        return false;
                    } else {
                        console.debug(`${Date.now()} No edits yet. Wait a beat (${retries})...`);
                        return EditorQueryEvaluator.formatResults(resultsEditorTabIdentifier, retries + 1);
                    }
                }
            );
    }

    /**
     * Show the query results at a given URI
     * @param resultsEditorTabIdentifier the response URI (where VS Code will call/show the query results)
     * @param editor results will be shown one column to the right
     * @returns Promise resolves to editor passed in, unchanged @async
     */
    private static async showFormattedResults(resultsEditorTabIdentifier: Uri, editor: TextEditor): Promise<TextEditor> {
        return workspace.openTextDocument(resultsEditorTabIdentifier)
            .then((doc: TextDocument) => {
                return window.showTextDocument(doc, editor.viewColumn + 1, true);
            })
            .then((editor: TextEditor) => {
                EditorQueryEvaluator.formatResults(resultsEditorTabIdentifier);
                return editor;
            });
    }
}