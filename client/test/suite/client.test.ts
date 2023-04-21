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

import * as assert from 'assert';
import { after } from 'mocha';
import { Selection, TextEditor, window, workspace, Uri } from 'vscode';

import { defaultDummyGlobalState } from './dummyGlobalState';
import {
    testOverrideQueryWithGoodJSON, testOverrideQueryWithBadJSON, testQueryWithoutOverrides,
    testOverrideXQueryWithGoodJSON, testOverrideXQueryWithBadJSON, testXQueryWithoutOverrides,
    testOverrideSslParams
} from './testOverrideQuery';
import { MLRuntime } from '../../JSDebugger/mlRuntime';
import { AttachRequestArguments } from '../../JSDebugger/mlDebug';
import { ClientContext } from '../../marklogicClient';
import { ClientResponseProvider } from '../../clientResponseProvider';
import { getDbClient, parseQueryForOverrides } from '../../vscQueryParameterTools';
import { EditorQueryEvaluator } from '../../editorQueryEvaluator';

const SJS = 'sjs';
const XQY = 'xqy';

suite('Extension Test Suite', () => {
    after(() => {
        window.showInformationMessage('All tests done!');
    });

    test('When the editor has no text selected', async () => {
        const textDocumentContents = 'Hello, World!\n--xdmp.random()--\nGoodbye, Cruel World';
        let queryText: string;
        await workspace.openTextDocument({
            language: 'javascript',
            content: textDocumentContents
        })
            .then(document => {
                return window.showTextDocument(document);
            })
            .then((editor: TextEditor) => {
                queryText = EditorQueryEvaluator.getQueryFromEditor(editor);
            });
        assert.strictEqual(queryText, textDocumentContents, 'The entire document should be returned');
    });

    test('When the editor has selected text', async () => {
        const textDocumentContents = 'Hello, World!\n--xdmp.random()--\nGoodbye, Cruel World';
        const expectedSelectedText = 'xdmp.random()';
        let queryText: string;
        await workspace.openTextDocument({
            language: 'javascript',
            content: textDocumentContents
        })
            .then(document => {
                return window.showTextDocument(document);
            })
            .then((editor: TextEditor) => {
                editor.selection = new Selection(1, 2, 1, 15);
                queryText = EditorQueryEvaluator.getQueryFromEditor(editor);
            });
        assert.strictEqual(queryText, expectedSelectedText, 'Then only the selected text should be returned');
    });

    test('When a RunTime object is initialized with a custom managePort', async () => {
        const runTime = new MLRuntime();
        const args: AttachRequestArguments = {
            rid: '', root: '',
            username: 'user', password: 'pass',
            hostname: 'server', debugServerName: null, managePort: 11111,
            ssl: false, pathToCa: null, rejectUnauthorized: false
        };
        runTime.initialize(args);
        assert.strictEqual(runTime.getDbgPort(), 11111, 'the custom managePort should be reflected in the RunTime object');
    });

    test('getDbClient should cache its settings in the state passed to it', () => {
        const config = workspace.getConfiguration();
        const gstate = defaultDummyGlobalState();
        const newHost: string = Math.random().toString(36);

        const firstClient: ClientContext = getDbClient('', SJS, config, gstate);
        firstClient.params.host = newHost;

        // Verify next client is different since firstClient's params were modified
        const secondClient: ClientContext = getDbClient('', SJS, config, gstate);
        assert.notStrictEqual(firstClient, secondClient);
        assert.notDeepStrictEqual(firstClient, secondClient);

        // Verify third client is same as second client since their params are the same
        const thirdClient = getDbClient('', SJS, config, gstate);
        assert.strictEqual(thirdClient, secondClient);
        assert.notStrictEqual(thirdClient.params.host, newHost);
    });

    test('override parser should recognize config overrides', () => {
        const queryText: string = testOverrideQueryWithGoodJSON();
        const overrides = parseQueryForOverrides(queryText, SJS);
        assert.strictEqual(overrides.host, 'overrideHost');
        assert.strictEqual(overrides.port, 12345);
    });

    test('overrides should not touch parameters they do not specify', () => {
        const config = workspace.getConfiguration();
        const cfgPwd = config.get('marklogic.password');
        const cfgPca = String(config.get('marklogic.pathToCa') || '');
        const queryText: string = testOverrideQueryWithGoodJSON();
        const overrides = parseQueryForOverrides(queryText, SJS);
        const gstate = defaultDummyGlobalState();
        const dbClientContext: ClientContext = getDbClient(queryText, SJS, config, gstate);

        assert.strictEqual(overrides.host, dbClientContext.params.host);
        // The pwd value in mlClient1.params will always be of type string, so have to cast the expected value
        assert.strictEqual(dbClientContext.params.pwd, String(cfgPwd));
        assert.strictEqual(dbClientContext.params.pathToCa, cfgPca);
    });

    test('override parser should throw if settings are invalid JSON', () => {
        const badQueryText: string = testOverrideQueryWithBadJSON();
        assert.throws(() => {
            parseQueryForOverrides(badQueryText, SJS);
        });
    });

    test('having no override flag should cause overrides to be ignored', () => {
        const noOQuery: string = testQueryWithoutOverrides();
        const overrides: Record<string, any> = parseQueryForOverrides(noOQuery, SJS);
        assert.strictEqual(Object.keys(overrides).length, 0);
    });

    test('override XQuery parser should recognize config overrides', () => {
        const queryText: string = testOverrideXQueryWithGoodJSON();
        const overrides: Record<string, any> = parseQueryForOverrides(queryText, XQY);
        assert.strictEqual(overrides.host, 'overrideHost');
        assert.strictEqual(overrides.port, 12345);
    });

    test('override XQuery parser should throw if settings are invalid JSON', () => {
        const badQueryText: string = testOverrideXQueryWithBadJSON();
        assert.throws(() => {
            parseQueryForOverrides(badQueryText, XQY);
        });
    });

    test('having no override XQuery flag should cause overrides to be ignored', () => {
        const noOQuery: string = testXQueryWithoutOverrides();
        const overrides: Record<string, any> = parseQueryForOverrides(noOQuery, XQY);
        assert.strictEqual(Object.keys(overrides).length, 0);
    });

    test('overrides in ssl settings are honored', () => {
        const sslOverrideQuery: string = testOverrideSslParams();
        const overrides: Record<string, any> = parseQueryForOverrides(sslOverrideQuery, SJS);
        assert.strictEqual(overrides.ssl, true);
        assert.strictEqual(overrides.rejectUnauthorized, false);
        assert.strictEqual(overrides.host, '127.0.0.1');
    });

    test('When a JavaScript, XQuery, or SQL tab is evaled and a URI is generated to uniquely identify the results', async () => {
        const provider = new ClientResponseProvider();
        const fileUri = Uri.from({
            'scheme': 'scheme',
            'authority': 'localhost:9876',
            'path': '//src/fake/script.sjs',
            'query': 'query',
            'fragment': 'fragment'
        });
        const expectedResponseUri = 'mlquery://localhost:9876/src/fake/script.sjs.nothing?query';
        await provider.writeResponseToUri(fileUri, [])
            .then((actualResponseUri) => {
                assert.strictEqual(actualResponseUri.toString(), expectedResponseUri,
                    'the URI should not have a double-dash before the filename section');
            });
    });

    test('When a SPARQL tab is evaled and a URI is generated to uniquely identify the results', async () => {
        const provider = new ClientResponseProvider();
        const fileUri = Uri.from({
            'scheme': 'scheme',
            'authority': 'localhost:9876',
            'path': '//src/fake/script.sparql',
            'query': 'query',
            'fragment': 'fragment'
        });
        const expectedResponseUri = 'mlquery://localhost:9876/src/fake/script.sparql.json?query';
        await provider.writeSparqlResponseToUri(fileUri, [])
            .then((actualResponseUri) => {
                assert.strictEqual(actualResponseUri.toString(), expectedResponseUri,
                    'the URI should not have a double-dash before the filename section');
            });
    });

});
