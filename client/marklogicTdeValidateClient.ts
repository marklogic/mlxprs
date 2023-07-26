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

import { XMLParser } from 'fast-xml-parser';
import * as fs from 'fs';
import path = require('path');
import { ExtensionContext, window, workspace } from 'vscode';

import { ClientContext, sendJSQuery, sendXQuery } from './marklogicClient';
import { buildMlxprsErrorFromError, MlxprsError } from './mlxprsErrorBuilder';
import { MlxprsErrorReporter } from './mlxprsErrorReporter';
import { MlxprsWebViewProvider } from './mlxprsWebViewProvider';

export class MarkLogicTdeValidateClient {
    static mlxprsWebViewProvider: MlxprsWebViewProvider = null;
    static xmlParserOptions = {
        ignoreAttributes: false,
        attributeNamePrefix: '@_',
        format: true
    };
    static xmlParser = new XMLParser(MarkLogicTdeValidateClient.xmlParserOptions);

    public static registerMlxprsResultsViewProvider(mlxprsWebViewProvider: MlxprsWebViewProvider) {
        MarkLogicTdeValidateClient.mlxprsWebViewProvider = mlxprsWebViewProvider;
    }

    private extensionContext: ExtensionContext;

    public constructor(context: ExtensionContext) {
        this.extensionContext = context;
    }

    private getTdeFormat(tdeText: string) {
        try {
            JSON.parse(tdeText);
            return 'JSON';
        } catch (e) {}

        try {
            const parsedXml = MarkLogicTdeValidateClient.xmlParser.parse(tdeText, true);
            if (Object.keys(parsedXml).length > 0) {
                return 'XML';
            }
        } catch (e) {}

        return null;
    }

    private buildJsonValidationQuery(tdeText: string) {
        return `'use strict'; var tde = require('/MarkLogic/tde.xqy'); var t1=xdmp.toJSON(${tdeText}); tde.validate([t1],[]);`;
    }

    private buildXmlValidationQuery(tdeText: string) {
        return `tde:validate(${tdeText})`;
    }

    private handleResults(validationResults: object): string {
        const result = validationResults[0]['value'] as string;
        const formattedResults = MlxprsWebViewProvider.convertTextResponseToHtml(JSON.stringify(result, null, 2));
        if (MarkLogicTdeValidateClient.mlxprsWebViewProvider) {
            MarkLogicTdeValidateClient.mlxprsWebViewProvider.updateViewContent(formattedResults);
        }
        return result;
    }

    private handleValidateError(error: Error): string {
        const errorMessage = `Unable to validate the template: ${error['body']['errorResponse']['message']}`;
        const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, errorMessage);
        MlxprsErrorReporter.reportError(mlxprsError);
        return errorMessage;
    }

    private async validateJsonTde(
        dbClientContext: ClientContext, tdeText: string
    ): Promise<unknown> {
        const validationQuery = this.buildJsonValidationQuery(tdeText);
        return sendJSQuery(dbClientContext, validationQuery)
            .result((validationResults: unknown) => {
                return this.handleResults(validationResults as object);
            })
            .catch(error => {
                return this.handleValidateError(error);
            });
    }

    private async validateXmlTde(
        dbClientContext: ClientContext, tdeText: string
    ): Promise<unknown> {
        const validationQuery = this.buildXmlValidationQuery(tdeText);
        return sendXQuery(dbClientContext, validationQuery)
            .result((validationResults: unknown) => {
                return this.handleResults(validationResults as object);
            })
            .catch(error => {
                return this.handleValidateError(error);
            });
    }

    public async validateTdeTemplate(
        dbClientContext: ClientContext, tdeText: string
    ): Promise<unknown> {
        const tdeFormat = this.getTdeFormat(tdeText);

        if (tdeFormat === 'JSON') {
            return this.validateJsonTde(dbClientContext, tdeText);
        } else if (tdeFormat === 'XML') {
            return this.validateXmlTde(dbClientContext, tdeText);
        } else {
            const errorMessage = 'To be validated, the template must be either valid JSON or XML.';
            const mlxprsError: MlxprsError = buildMlxprsErrorFromError({} as Error, errorMessage);
            MlxprsErrorReporter.reportError(mlxprsError);
            return errorMessage;
        }
    }

    private getEditorWorkspaceFolder(): string | undefined {
        const fileName = window.activeTextEditor?.document.fileName;
        return workspace.workspaceFolders
            ?.map((folder) => folder.uri.fsPath)
            .filter((fsPath) => fileName?.startsWith(fsPath))[0];
    }

    private loadLocalDocument(filePath: string, rootDir: string): string {
        try {
            let targetFilePath = filePath;
            if (!filePath.startsWith(path.sep)) {
                targetFilePath = `${rootDir}${path.sep}${filePath}`;
            }
            const dataDocument = fs.readFileSync(targetFilePath, 'utf8');
            return `xdmp.unquote(\`${dataDocument}\`)`;
        } catch (e) {
            const errorMessage = 'Error reading test file: ' + e.message;
            const mlxprsError: MlxprsError = buildMlxprsErrorFromError({} as Error, errorMessage);
            MlxprsErrorReporter.reportError(mlxprsError);
            return null;
        }
    }

    private getTargetDocumentFromJsonVars(
        tdeJson: object, rootDir: string
    ): string {
        const vars = tdeJson['template']['vars'];
        if (vars) {
            const uriVarObj = vars.find(varObj => varObj.name === 'MLXPRS_TEST_URI');
            if (uriVarObj) {
                return `fn.document('${uriVarObj.val}')`;
            } else {
                const fileVarObj = vars.find(varObj => varObj.name === 'MLXPRS_TEST_FILE');
                if (fileVarObj) {
                    try {
                        return this.loadLocalDocument(fileVarObj.val, rootDir);
                    } catch (e) {
                        const errorMessage = 'Error reading test file: ' + e.message;
                        const mlxprsError: MlxprsError = buildMlxprsErrorFromError({} as Error, errorMessage);
                        MlxprsErrorReporter.reportError(mlxprsError);
                        return null;
                    }
                } else {
                    return null;
                }
            }
        }
        return null;
    }

    private getTargetDocumentFromXmlVars(
        tdeText: object, rootDir: string
    ): string {
        const vars = tdeText['template']['vars'];
        if (vars) {
            if (vars.var) {
                if (Array.isArray(vars.var)) {
                    const uriVarObj = vars.var.find(varObj => varObj.name === 'MLXPRS_TEST_URI');
                    if (uriVarObj) {
                        return `fn.document('${uriVarObj.val}')`;
                    } else {
                        const fileVarObj = vars.var.find(varObj => varObj.name === 'MLXPRS_TEST_FILE');
                        if (fileVarObj) {
                            try {
                                return this.loadLocalDocument(fileVarObj.val, rootDir);
                            } catch (e) {
                                const errorMessage = 'Error reading test file: ' + e.message;
                                const mlxprsError: MlxprsError = buildMlxprsErrorFromError({} as Error, errorMessage);
                                MlxprsErrorReporter.reportError(mlxprsError);
                                return null;
                            }
                        } else {
                            return null;
                        }
                    }
                } else {
                    if (vars.var.name === 'MLXPRS_TEST_URI') {
                        return `fn.document('${vars.var.val}')`;
                    } else if (vars.var.name === 'MLXPRS_TEST_FILE') {
                        const fileVarObj = vars.var.find(varObj => varObj.name === 'MLXPRS_TEST_FILE');
                        try {
                            return this.loadLocalDocument(fileVarObj.val, rootDir);
                        } catch (e) {
                            const errorMessage = 'Error reading test file: ' + e.message;
                            const mlxprsError: MlxprsError = buildMlxprsErrorFromError({} as Error, errorMessage);
                            MlxprsErrorReporter.reportError(mlxprsError);
                            return null;
                        }
                    } else {
                        return null;
                    }
                }
            }
        }
        return null;
    }

    private buildNodeExtractQuery(tdeText: string, targetDocument: string) {
        return `'use strict'; var tde = require('/MarkLogic/tde.xqy'); var template = xdmp.unquote(\`${tdeText}\`); tde.nodeDataExtract([${targetDocument}], [template]);`;
    }

    private handleExtractNodesError(error: Error): string {
        const errorMessage = `Unable to extract nodes using the template: ${error['body']['errorResponse']['message']}`;
        const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, errorMessage);
        MlxprsErrorReporter.reportError(mlxprsError);
        return errorMessage;
    }

    // The rootDir parameter is generally retrieved from the current workspace and the current editor
    // using the getEditorWorkspaceFolder() method
    // However, during the automated tests, those values are unavailable, so the value must be passed in
    public async tdeExtractNodes(
        dbClientContext: ClientContext, tdeText: string, rootDir: string = null
    ): Promise<unknown> {
        const tdeFormat = this.getTdeFormat(tdeText);
        if (rootDir === null) {
            rootDir = this.getEditorWorkspaceFolder();
        }
        if (tdeFormat) {
            let targetDocument = null;
            if (tdeFormat === 'JSON') {
                const tdeJson = JSON.parse(tdeText);
                targetDocument = this.getTargetDocumentFromJsonVars(tdeJson, rootDir);
            } else {
                const tdeXml = MarkLogicTdeValidateClient.xmlParser.parse(tdeText);
                targetDocument = this.getTargetDocumentFromXmlVars(tdeXml, rootDir);
            }
            if (targetDocument) {
                const nodeExtractQuery = this.buildNodeExtractQuery(tdeText, targetDocument);
                return sendJSQuery(dbClientContext, nodeExtractQuery)
                    .result((validationResults: unknown) => {
                        return this.handleResults(validationResults as object);
                    })
                    .catch(error => {
                        return this.handleExtractNodesError(error);
                    });
            } else {
                const errorMessage = 'To perform node extraction, the template must include a "var" entry with the name property "MLXPRS_TEST_URI" or "MLXPRS_TEST_FILE", and a val property with the URI of the target document.';
                const mlxprsError: MlxprsError = buildMlxprsErrorFromError({} as Error, errorMessage);
                MlxprsErrorReporter.reportError(mlxprsError);
                return errorMessage;
            }
        } else {
            const errorMessage = 'To perform node extraction, the template must be either valid JSON or XML.';
            const mlxprsError: MlxprsError = buildMlxprsErrorFromError({} as Error, errorMessage);
            MlxprsErrorReporter.reportError(mlxprsError);
            return errorMessage;
        }
    }
}