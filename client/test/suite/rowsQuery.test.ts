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
import { defaultDummyGlobalState } from './dummyGlobalState';
import { sendRows } from '../../marklogicClient';
import * as ml from 'marklogic';

const dslQuery = 'op.fromView()';
const serializedQueryString = '{ "$optic": { "ns": "op", "fn": "operators", "args": [{ "ns": "op", "fn": "from-view", "args": ["Medical", "Authors"] }] } }';
const rowsResponseFormats: ml.RowsResponseFormat[] = ['json', 'xml', 'csv'];

let calculatedOptions: ml.RowsOptions;
let calculatedQuery: object | string;
function dummyRowsQuerier(): ml.Rows {
    return {
        query: (actualQuery: object | string, options: ml.RowsOptions): Promise<ml.RowsResponse> => {
            calculatedQuery = actualQuery;
            calculatedOptions = options;
            return null;
        }
    };
}
const gstate = defaultDummyGlobalState();
gstate.dummyClient.databaseClient.rows = dummyRowsQuerier();

suite('Rows Query Test Suite', () => {

    test('When an Optic DSL query is passed into the sendRows function', async () => {
        rowsResponseFormats.forEach((rowsResponseFormat) => {
            const rowsQueryType: ml.RowsQueryType = 'dsl';
            const expectedOptions: ml.RowsOptions = { 'queryType': rowsQueryType, 'format': rowsResponseFormat };

            sendRows(gstate.dummyClient, dslQuery, rowsResponseFormat);
            assert.deepEqual(calculatedQuery, dslQuery, `the query is passed as "${rowsQueryType}" to the MarkLogic query function`);
            assert.deepEqual(calculatedOptions, expectedOptions, `the options passed to the MarkLogic query function specify "${rowsResponseFormat}"`);
        });
    });

    test('When a serialized Optic query is passed into the sendRows function', async () => {
        rowsResponseFormats.forEach((rowsResponseFormat) => {
            const rowsQueryType: ml.RowsQueryType = 'json';
            const expectedOptions: ml.RowsOptions = { 'queryType': rowsQueryType, 'format': rowsResponseFormat };

            sendRows(gstate.dummyClient, serializedQueryString, rowsResponseFormat);
            assert.deepEqual(calculatedQuery, JSON.parse(serializedQueryString), `the query is passed as "${rowsQueryType}" to the MarkLogic query function`);
            assert.deepEqual(calculatedOptions, expectedOptions, `the options passed to the MarkLogic query function specify "${rowsResponseFormat}"`);
        });
    });

});
