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

import path = require('path');
import {
    ExtensionContext, TextEditor, WorkspaceConfiguration
} from 'vscode';

import { ClientContext, MlClientParameters, requestMarkLogicUnitTest } from './marklogicClient';
import { buildMlxprsErrorFromError, MlxprsError } from './mlxprsErrorBuilder';
import { MlxprsErrorReporter } from './mlxprsErrorReporter';
import { MlxprsWebViewProvider } from './mlxprsWebViewProvider';

export class MarkLogicUnitTestClient {
    static mlxprsWebViewProvider: MlxprsWebViewProvider = null;

    public static registerMlxprsResultsViewProvider(mlxprsWebViewProvider: MlxprsWebViewProvider) {
        MarkLogicUnitTestClient.mlxprsWebViewProvider = mlxprsWebViewProvider;
    }

    private extensionContext: ExtensionContext;

    public constructor(context: ExtensionContext) {
        this.extensionContext = context;
    }

    private newMarklogicUnitTestClient(cfg: WorkspaceConfiguration): ClientContext {
        const configParams: Record<string, unknown> = {
            host: String(cfg.get('marklogic.host')),
            user: String(cfg.get('marklogic.username')),
            pwd: String(cfg.get('marklogic.password')),
            port: Number(cfg.get('marklogic.unitTestPort')),
            contentDb: null,
            modulesDb: null,
            authType: String(cfg.get('marklogic.authType')).toUpperCase(),
            ssl: Boolean(cfg.get('marklogic.ssl')),
            pathToCa: String(cfg.get('marklogic.pathToCa') || ''),
            rejectUnauthorized: Boolean(cfg.get('marklogic.rejectUnauthorized'))
        };
        const newParams = new MlClientParameters(configParams);
        return new ClientContext(newParams);
    }

    public async runTestModule(
        cfg: WorkspaceConfiguration, editor: TextEditor
    ): Promise<void> {
        const splitString = `test${path.sep}suites${path.sep}`;
        const filePath = editor.document.uri.path;
        const splitLocation = filePath.lastIndexOf(splitString) + splitString.length;
        if (splitLocation > splitString.length) {
            const testPath = filePath.substring(splitLocation);
            const lastSlash = testPath.lastIndexOf('/');
            const testSuite = testPath.substring(0, lastSlash);
            const testFile = testPath.substring(lastSlash + 1);

            const dbClientContext: ClientContext = this.newMarklogicUnitTestClient(cfg);
            requestMarkLogicUnitTest(dbClientContext, testSuite, testFile)
                .result((testResults: string) => {
                    const testResultsHtml = MlxprsWebViewProvider.convertXmlResponseToHtml(testResults);
                    MarkLogicUnitTestClient.mlxprsWebViewProvider.updateViewContent(testResultsHtml);
                    return null;
                })
                .catch(error => {
                    const mlxprsError: MlxprsError = buildMlxprsErrorFromError(error, `Unable to run the test module: ${error['code']}`);
                    MlxprsErrorReporter.reportError(mlxprsError);
                    return null;
                });
        } else {
            const errorMessage = 'Unable to run test; please ensure the file is a marklogic-unit-test module located in a test suite directory';
            const pathError = new Error(errorMessage);
            const mlxprsError: MlxprsError = buildMlxprsErrorFromError(pathError, errorMessage);
            MlxprsErrorReporter.reportError(mlxprsError);
            return null;
        }
        return null;
    }
}