/*
 * Copyright (c) 2023 MarkLogic Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import * as ml from 'marklogic';
import { EventEmitter } from 'stream';
import {
    ExtensionContext, TextDocument, TextEdit, TextEditor, Uri,
    WorkspaceEdit, commands, window, workspace, WorkspaceConfiguration
} from 'vscode';

import { buildClientFactoryFromWorkspaceConfig } from './clientFactory';
import { ClientResponseProvider, ErrorResultsObject } from './clientResponseProvider';
import { MlxprsErrorReporter } from './mlxprsErrorReporter';
import { ClientContext, sendJSQuery, sendGraphQl, sendRows, sendSparql, sendXQuery } from './marklogicClient';
import { buildMlxprsErrorFromError, MlxprsError } from './mlxprsErrorBuilder';
import { MlxprsWebViewProvider } from './mlxprsWebViewProvider';
import { getSparqlQueryForm, getSparqlResponseType } from './sparqlQueryHelper';
import { parseQueryForOverrides } from './vscQueryParameterTools';

export enum EditorQueryType {
    JS,
    XQY,
    SPARQL,
    SQL,
    GRAPHQL,
    ROWS
}

export class EditorQueryEvaluator {
    static mlxprsWebViewProvider: MlxprsWebViewProvider = null;

    private static FOPTIONS = { tabSize: 2, insertSpaces: true };
    private static FCOMMAND = 'vscode.executeFormatDocumentProvider';
    private static SJS = 'sjs';
    private static XQY = 'xqy';

    public static registerMlxprsResultsViewProvider(mlxprsWebViewProvider: MlxprsWebViewProvider) {
        EditorQueryEvaluator.mlxprsWebViewProvider = mlxprsWebViewProvider;
    }

    private extensionContext: ExtensionContext;
    private provider: ClientResponseProvider;
    private cfg: WorkspaceConfiguration;
    private sendResultsToEditorTab: boolean;

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

    /* eslint-disable indent */
    public editorQuery(
        editorQueryType: EditorQueryType, editor: TextEditor, rowsResponseFormat?: ml.RowsResponseFormat
    ): void {
        const query = EditorQueryEvaluator.getQueryFromEditor(editor);
        this.cfg = workspace.getConfiguration();
        this.sendResultsToEditorTab = Boolean(this.cfg.get('marklogic.resultsInEditorTab'));
        let language = EditorQueryEvaluator.SJS;
        if (editorQueryType === EditorQueryType.XQY) {
            language = EditorQueryEvaluator.XQY;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const overrides: Record<string, any> = parseQueryForOverrides(query, language);
        const dbClientContext = buildClientFactoryFromWorkspaceConfig(this.cfg, overrides).newMarklogicRestClient();
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
                this.editorSqlQuery(dbClientContext, query, resultsEditorTabIdentifier, editor, this.cfg);
                break;
            case EditorQueryType.GRAPHQL:
                this.editorRowsQuery(dbClientContext, query, resultsEditorTabIdentifier, editor, 'json', 'graphql');
                break;
            case EditorQueryType.ROWS:
                this.editorRowsQuery(dbClientContext, query, resultsEditorTabIdentifier, editor, rowsResponseFormat, 'optic');
                break;
        }
    }

    private updateResultsViewWithRecordArray(resultsEditorTabIdentifier: Uri, recordResults: Record<string, unknown>[], isSparql: boolean): Promise<Uri> {
        let resultsEditorTabIdentifierPromise = null;
        if (this.sendResultsToEditorTab) {
            if (isSparql) {
                resultsEditorTabIdentifierPromise = this.provider.writeSparqlResponseToUri(resultsEditorTabIdentifier, recordResults);
            } else {
                resultsEditorTabIdentifierPromise = this.provider.writeResponseToUri(resultsEditorTabIdentifier, recordResults);
            }
        } else {
            EditorQueryEvaluator.requestMlxprsWebviewUpdateWithRecordArray(recordResults);
        }
        return resultsEditorTabIdentifierPromise;
    }

    private updateResultsViewWithError(resultsEditorTabIdentifier: Uri, error: Record<string, unknown>[]): Promise<Uri> {
        let resultsEditorTabIdentifierPromise = null;
        if (this.sendResultsToEditorTab) {
            resultsEditorTabIdentifierPromise = this.provider.handleError(resultsEditorTabIdentifier, error);
        } else {
            const errorResultsObject = ClientResponseProvider.buildErrorResultsObject(error);
            EditorQueryEvaluator.requestMlxprsWebviewUpdateWithErrorResultsObject(errorResultsObject);
        }
        return resultsEditorTabIdentifierPromise;
    }

    // public only for testing purposes
    public editorJSQuery(
        dbClientContext: ClientContext,
        query: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor,
        // The EventEmitter parameter is only used for testing. Production clients should not pass anything for this param.
        evaluatorEmitter?: EventEmitter
    ): void {
        sendJSQuery(dbClientContext, query)
            .result(
                (recordResults: Record<string, unknown>[]) => {
                    return this.updateResultsViewWithRecordArray(resultsEditorTabIdentifier, recordResults, false);
                },
                (error: Error) => {
                    const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, `Unable to evaluate the query: ${error['code']}`);
                    MlxprsErrorReporter.reportError(mlxprsError);
                    return null;
                })
            .then(resultsEditorTabIdentifier => {
                if (resultsEditorTabIdentifier && (this.sendResultsToEditorTab)) {
                    EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor);
                }
                if (evaluatorEmitter) {
                    evaluatorEmitter.emit('complete');
                }
            });
    }

    // public only for testing purposes
    public editorXQuery(
        dbClientContext: ClientContext,
        query: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor,
        prefix: 'xdmp' | 'dbg' = 'xdmp',
        // The EventEmitter parameter is only used for testing. Production clients should not pass anything for this param.
        evaluatorEmitter?: EventEmitter
    ): void {
        sendXQuery(dbClientContext, query, prefix)
            .result(
                (recordResults: Record<string, unknown>[]) => {
                    return this.updateResultsViewWithRecordArray(resultsEditorTabIdentifier, recordResults, false);
                },
                (error: Error) => {
                    const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, 'Unable to evaluate the query');
                    MlxprsErrorReporter.reportError(mlxprsError);
                    return null;
                })
            .then(resultsEditorTabIdentifier => {
                if (resultsEditorTabIdentifier && (this.sendResultsToEditorTab)) {
                    EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor);
                }
                if (evaluatorEmitter) {
                    evaluatorEmitter.emit('complete');
                }
            });
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
                (recordResults: Record<string, unknown>[]) => {
                    return this.updateResultsViewWithRecordArray(resultsEditorTabIdentifier, recordResults, false);
                },
                (error: Error) => {
                    const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, `Unable to evaluate the query: ${error['code']}`);
                    MlxprsErrorReporter.reportError(mlxprsError);
                    return null;
                })
            .then(resultsEditorTabIdentifier => {
                if (resultsEditorTabIdentifier && (this.sendResultsToEditorTab)) {
                    EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor);
                }
            });
    }

    private editorSparqlQuery(
        dbClientContext: ClientContext,
        sparqlQuery: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor
    ): void {
        const queryType: ml.SparqlQueryType = getSparqlQueryForm(sparqlQuery);
        const contentType: ml.SparqlResponseFormat = getSparqlResponseType(queryType);
        sendSparql(dbClientContext, sparqlQuery, contentType)
            .result(
                (recordResults: Record<string, unknown>) => {
                    return this.updateResultsViewWithRecordArray(resultsEditorTabIdentifier, [recordResults], true);
                },
                (error: Error) => {
                    const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, `Unable to evaluate the query: ${error['code']}`);
                    MlxprsErrorReporter.reportError(mlxprsError);
                    return null;
                })
            .then(resultsEditorTabIdentifier => {
                if (resultsEditorTabIdentifier && (this.sendResultsToEditorTab)) {
                    EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor);
                }
            });
    }

    // public only for testing purposes
    public editorRowsQuery(
        dbClientContext: ClientContext,
        query: string,
        resultsEditorTabIdentifier: Uri,
        editor: TextEditor,
        resultFormat: ml.RowsResponseFormat,
        queryType: string,
        // The EventEmitter parameter is only used for testing. Production clients should not pass anything for this param.
        evaluatorEmitter?: EventEmitter
    ): void {
        let queryFunction = sendRows;
        if (queryType === 'graphql') {
            queryFunction = sendGraphQl;
        }
        queryFunction(dbClientContext, query, resultFormat)
            .then(
                (response: ml.RowsResponse) => {
                    if (response.preRequestError) {
                        return this.updateResultsViewWithError(resultsEditorTabIdentifier, response.preRequestError as any);
                    } else {
                        let resultsEditorTabIdentifierPromise = null;
                        if (this.sendResultsToEditorTab) {
                            resultsEditorTabIdentifierPromise = this.provider.writeRowsResponseToUri(resultsEditorTabIdentifier, response, resultFormat);
                        } else {
                            EditorQueryEvaluator.requestMlxprsWebviewUpdateWithRowsResponse(response, resultFormat);
                        }
                        return resultsEditorTabIdentifierPromise;
                    }
                }
            )
            .catch(error => {
                const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, `Unable to evaluate the query: ${error['code']}`);
                MlxprsErrorReporter.reportError(mlxprsError);
                return null;
            })
            .then(resultsEditorTabIdentifier => {
                if (resultsEditorTabIdentifier && (this.sendResultsToEditorTab)) {
                    EditorQueryEvaluator.showFormattedResults(resultsEditorTabIdentifier, editor);
                }
                if (evaluatorEmitter) {
                    evaluatorEmitter.emit('complete');
                }
            });
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

    private static requestMlxprsWebviewUpdateWithErrorResultsObject(response: ErrorResultsObject): void {
        if (EditorQueryEvaluator.mlxprsWebViewProvider) {
            EditorQueryEvaluator.focusOnResultsView();
            const stringResults = MlxprsWebViewProvider.convertTextResponseToHtml(JSON.stringify(response, null, 2));
            EditorQueryEvaluator.mlxprsWebViewProvider.updateViewContent(stringResults);
        }
    }

    private static requestMlxprsWebviewUpdateWithRowsResponse(response: ml.RowsResponse, resultFormat?: ml.RowsResponseFormat): void {
        if (EditorQueryEvaluator.mlxprsWebViewProvider) {
            EditorQueryEvaluator.focusOnResultsView();
            let stringResults = '';
            if (resultFormat === 'json') {
                stringResults = MlxprsWebViewProvider.convertTextResponseToHtml(JSON.stringify(response, null, 2));
            } else if (resultFormat === 'xml') {
                stringResults = MlxprsWebViewProvider.convertXmlResponseToHtml(response.toString());
            } else {
                stringResults = MlxprsWebViewProvider.convertTextResponseToHtml(response.toString());
            }
            EditorQueryEvaluator.mlxprsWebViewProvider.updateViewContent(stringResults);
        }
    }

    private static requestMlxprsWebviewUpdateWithRecordArray(response: Record<string, unknown>[], contentType?: string): void {
        if (EditorQueryEvaluator.mlxprsWebViewProvider) {
            EditorQueryEvaluator.focusOnResultsView();
            const stringResults = response.map(record => EditorQueryEvaluator.convertRecordToHtml(record, contentType)).join('\n');
            EditorQueryEvaluator.mlxprsWebViewProvider.updateViewContent(stringResults);
        }
    }

    // This function is necessary to ensure that the MLXPRS: RESULTS panel exists and is updated as soon as possible
    // For more information, see:
    // https://github.com/microsoft/vscode/issues/175129
    // https://github.com/microsoft/vscode/issues/146330
    private static focusOnResultsView() {
        commands.executeCommand(`${MlxprsWebViewProvider.viewType}.focus`);
    }

    private static convertRecordToHtml(record: Record<string, any>, contentType?: string): string {
        if (record['format'] === 'xml') {
            return MlxprsWebViewProvider.convertXmlResponseToHtml(record['value']);
        }
        if (record['format'] === 'text' && record['datatype'] === 'node()') {
            return MlxprsWebViewProvider.convertTextResponseToHtml(ClientResponseProvider.decodeBinaryText(record['value']));
        }
        if (record['format'] === 'text' && record['datatype'] === 'other') {
            return MlxprsWebViewProvider.convertTextResponseToHtml(record['value']);
        }
        if (record['head']) {
            return MlxprsWebViewProvider.convertTextResponseToHtml(JSON.stringify(record, null, 2));
        }
        if (record['value']) {
            return MlxprsWebViewProvider.convertTextResponseToHtml(JSON.stringify(record['value'], null, 2));
        }
        if (contentType === 'application/xml') {
            let rawXml = record.toString();
            if (rawXml.endsWith('\n')) {
                rawXml = rawXml.substring(0, rawXml.length - 1);
            }
            return MlxprsWebViewProvider.convertXmlResponseToHtml(rawXml);
        }
        return MlxprsWebViewProvider.convertTextResponseToHtml(record.toString());
    }
}
