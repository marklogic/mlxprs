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
