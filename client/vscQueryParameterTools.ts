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

import * as esprima from 'esprima';
import { Memento, WorkspaceConfiguration, window } from 'vscode';

import { MlxprsErrorReporter } from './mlxprsErrorReporter';
import { SJS, XQY, parseXQueryForOverrides, MLSETTINGSFLAG, ClientContext, MlClientParameters, MLDBCLIENT } from './marklogicClient';
import { MlxprsError } from './mlxprsErrorBuilder';

/**
 * In SJS/XQuery queries, you can override the VS Code mxprs settings in a comment.
 * The comment must have the following requirements:
 *
 * - Block comment as the very first language element in the query
 * - the first line of the block comment must include the string 'mlxprs:settings'
 * - the rest of the comment must be a valid JSON object
 * - the keys of the JSON object are the client parameters you wish to override
 *
 * @param queryText the text that will be checked for overrides
 * @returns a parsed overrides object. Value defined here will be used to override
 * what is configured in VS Code
 */
export function parseQueryForOverrides(queryText: string, language: string): Record<string, any> {
    if (language === XQY) {
        return parseXQueryForOverrides(queryText);
    }
    let overrides: Record<string, any> = {};
    const tokens: esprima.Token[] = esprima.tokenize(queryText, { comment: true, tolerant: true });
    if (tokens.length > 0 && tokens[0].type === 'BlockComment') {
        const firstBlockComment: string = tokens[0].value;
        const firstBlockCommentLine: string = firstBlockComment.split(/\n+/)[0]
            .replace(/\t+/g, '')
            .trim();
        if (firstBlockCommentLine.match(MLSETTINGSFLAG)) {
            const overridePayload: string = firstBlockComment
                .replace(MLSETTINGSFLAG, '')
                .trim();
            overrides = JSON.parse(overridePayload);
        }
    }
    return overrides;
}
/**
 * Caching mechanism for the ML Client in the extension's state. Checks the configuration for
 * changes against the client in the state (i.e. extension's global state)
 *
 * If the configuration wants a different client than the one in the state, replace the state's
 * client with a new one based on the config details.
 *
 * @param queryText the query to be checked for overrides. Can be left empty ('') if you don't need to parse overrides.
 * @param cfg ('config') most likely from `vscode.workspace.getConfiguration()`
 * @param language: string SJS or XQY
 * @param state most likely the extension's injected `context.globalState`
 *
 * @returns a MarklogicClient based on the contents of `cfg`
 */
export function getDbClient(queryText: string, language: string, cfg: WorkspaceConfiguration, state: Memento): ClientContext {
    const overrides: MlClientParameters = parseQueryForOverrides(queryText, language) as MlClientParameters;
    const configParams: Record<string, any> = {
        host: String(cfg.get('marklogic.host')),
        user: String(cfg.get('marklogic.username')),
        pwd: String(cfg.get('marklogic.password')),
        port: Number(cfg.get('marklogic.port')),
        managePort: Number(cfg.get('marklogic.managePort')),
        contentDb: String(cfg.get('marklogic.documentsDb')),
        modulesDb: String(cfg.get('marklogic.modulesDb')),
        authType: String(cfg.get('marklogic.authType')).toUpperCase(),
        ssl: Boolean(cfg.get('marklogic.ssl')),
        pathToCa: String(cfg.get('marklogic.pathToCa') || ''),
        rejectUnauthorized: Boolean(cfg.get('marklogic.rejectUnauthorized'))
    };
    // merge VS Code configuration and overrides
    const newParams = new MlClientParameters({ ...configParams, ...overrides });
    // if settings have changed, release and clear the client
    const cachedClient = state.get(MLDBCLIENT) as ClientContext;
    if (cachedClient !== null && !cachedClient.hasSameParamsAs(newParams)) {
        cachedClient.databaseClient.release();
        state.update(MLDBCLIENT, null);
        console.debug('Removed cached instance of MarklogicClient based on change in params');
    }
    // if there's no existing client in the globalState, instantiate a new one
    if (state.get(MLDBCLIENT) === null) {
        const dbClientContext: ClientContext = new ClientContext(newParams);
        try {
            state.update(MLDBCLIENT, dbClientContext);
            console.debug(`Created new MarklogicClient: ${state.get(MLDBCLIENT)}`);
        } catch (e) {
            console.error('Error: ' + JSON.stringify(e));
            e.message ? console.error(e.message) : null;
        }
    }
    return state.get(MLDBCLIENT) as ClientContext;
}
/**
 * Try to call `getDbClient()` with overrides. If we can't parse the
 * overrides, call `getDbClient()` with no overrides, and show the
 * user an error.
 */
export function cascadeOverrideClient(actualQuery: string, language: string, cfg: WorkspaceConfiguration, state: Memento): ClientContext {
    let dbClientContext: ClientContext = {} as ClientContext;
    try {
        dbClientContext = getDbClient(actualQuery, language, cfg, state);
    } catch (error) {
        window.showErrorMessage('could not parse JSON for overrides: ' + error.message);
        dbClientContext = getDbClient('', language, cfg, state);
    }
    return dbClientContext;
}

export function getDbClientWithoutOverrides(cfg: WorkspaceConfiguration, state: Memento): ClientContext {
    try {
        return getDbClient('', SJS, cfg, state);
    } catch (error) {
        const mlxprsError: MlxprsError = {
            reportedMessage: error.message,
            stack: error.stack,
            popupMessage: `Unable to build the MarkLogic database client: ${error.message}`
        };
        MlxprsErrorReporter.reportError(mlxprsError);
        return null;
    }
}
