/* eslint-disable @typescript-eslint/no-unused-vars */
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
import * as events from 'events';
import * as sinon from 'sinon';

import { EditorQueryEvaluator } from '../../editorQueryEvaluator';
import { ClientContext, sendJSQuery, sendRows, sendSparql, sendXQuery } from '../../marklogicClient';
import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';

suite('Testing SSL connectivity failures in various scenarios', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    const mlClient: ClientContext = integrationTestHelper.mlClient;
    const mlClientWithSslWithRejectUnauthorized: ClientContext = integrationTestHelper.mlClientWithSslWithRejectUnauthorized;
    const showErrorPopup = integrationTestHelper.showErrorPopup;
    const editorQueryEvaluator = new EditorQueryEvaluator(null, null);

    test('When attempting to Eval an XQY module that has syntax problems',
        async () => {
            await sendXQuery(mlClient, 'gibberish', 'xdmp')
                .result(
                    (_results: unknown) => {
                        assert.fail('The XQuery eval call should fail');
                    },
                    (error: unknown) => {
                        return null;
                    });
        }).timeout(5000);

    test('When attempting to Eval an XQY module on an App Server with a self-signed certificate and the client turns ON the \'rejectUnauthorized\' setting',
        async () => {
            await sendXQuery(mlClientWithSslWithRejectUnauthorized, '<hello>world</hello>', 'xdmp')
                .result(
                    (_results: unknown) => {
                        assert.fail('The XQuery eval call should fail');
                    },
                    (error: unknown) => {
                        return null;
                    });
        }).timeout(5000);

    test('When attempting to Eval an SJS module on an App Server with a self-signed certificate and the client turns ON the \'rejectUnauthorized\' setting',
        async () => {
            await sendJSQuery(mlClientWithSslWithRejectUnauthorized, '"A" + 1;')
                .result(
                    (_results: unknown) => {
                        assert.fail('The JavaScript eval call should fail');
                    },
                    (error: unknown) => {
                        return null;
                    });
        }).timeout(5000);

    test('When attempting to Eval an SPARQL module on an App Server with a self-signed certificate and the client turns ON the \'rejectUnauthorized\' setting',
        async () => {
            const sparqlQuery = 'PREFIX authors: <http://marklogic.com/column/Medical/Authors/> SELECT * WHERE { ?s authors:Date ?o }';
            await sendSparql(mlClientWithSslWithRejectUnauthorized, sparqlQuery, 'application/json')
                .result(
                    (_results: unknown) => {
                        assert.fail('The SPARQL eval call should fail');
                    },
                    (error: unknown) => {
                        return null;
                    });
        }).timeout(5000);

    test('When attempting to submit an Optic query to the /v1/rows endpoint on an App Server with a self-signed certificate and the client turns ON the \'rejectUnauthorized\' setting',
        async () => {
            const query = 'op.fromView("Medical", "Authors").where(op.eq(op.col("ID"), 5)).select(["LastName", "ForeName"]);';
            await sendRows(mlClientWithSslWithRejectUnauthorized, query, 'json')
                .then(
                    (response:unknown) => {
                        assert.fail('The JavaScript eval call should fail');
                    }
                )
                .catch(error => {
                    return null;
                });
        }).timeout(5000);

    test('When attempting to Eval an XQY module that has syntax problems',
        async () => {
            showErrorPopup.resetHistory();
            const evaluatorEmitter = new events.EventEmitter();
            editorQueryEvaluator.editorXQuery(mlClient, 'gibberish', null, null, 'xdmp', evaluatorEmitter);
            await events.once(evaluatorEmitter, 'complete');
            sinon.assert.calledWith(showErrorPopup, sinon.match('XDMP-MISSINGCONTEXT'));
        }).timeout(5000);

    test('When attempting to Eval an SJS module that has syntax problems',
        async () => {
            showErrorPopup.resetHistory();
            const evaluatorEmitter = new events.EventEmitter();
            editorQueryEvaluator.editorJSQuery(mlClient, 'gibberish', null, null, evaluatorEmitter);
            await events.once(evaluatorEmitter, 'complete');
            sinon.assert.calledWith(showErrorPopup, sinon.match('JS-JAVASCRIPT'));
        }).timeout(5000);

    test('When attempting to submit an Optic query that has syntax problems to the /v1/rows endpoint',
        async () => {
            showErrorPopup.resetHistory();
            const evaluatorEmitter = new events.EventEmitter();
            editorQueryEvaluator.editorRowsQuery(mlClient, 'gibberish', null, null, 'json', 'optic', evaluatorEmitter);
            await events.once(evaluatorEmitter, 'complete');
            sinon.assert.calledWith(showErrorPopup, sinon.match('INTERNAL ERROR'));
        }).timeout(5000);

});
