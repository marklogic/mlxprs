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
import { ExtensionContext } from 'vscode';

import { ClientContext, sendJSQuery, sendXQuery } from './marklogicClient';
import { buildMlxprsErrorFromError, MlxprsError } from './mlxprsErrorBuilder';
import { MlxprsErrorReporter } from './mlxprsErrorReporter';
import { MlxprsWebViewProvider } from './mlxprsWebViewProvider';

export class MarkLogicTdeValidateClient {
    static mlxprsWebViewProvider: MlxprsWebViewProvider = null;

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
            const options = {
                ignoreAttributes: false,
                attributeNamePrefix: '@_',
                format: true
            };
            const parser = new XMLParser(options);
            const parsedXml = parser.parse(tdeText);
            if (Object.keys(parsedXml).length > 0) {
                return 'XML';
            }
        } catch (e) {}

        return null;
    }

    private buildJsonValidationQuery(tdeText: string) {
        const validationQuery = `'use strict'; var tde = require('/MarkLogic/tde.xqy'); var t1=xdmp.toJSON(${tdeText}); tde.validate([t1],[]);`;
        return validationQuery;
    }

    private buildXmlValidationQuery(tdeText: string) {
        const validationQuery = `tde:validate(${tdeText})`;
        return validationQuery;
    }

    private handleResults(validationResults: object): string {
        const result = validationResults[0]['value'] as string;
        const formattedResults = MlxprsWebViewProvider.convertTextResponseToHtml(JSON.stringify(result, null, 2));
        MarkLogicTdeValidateClient.mlxprsWebViewProvider.updateViewContent(formattedResults);
        return result;
    }

    private handleError(error: Error): string {
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
                return this.handleError(error);
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
                return this.handleError(error);
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
}