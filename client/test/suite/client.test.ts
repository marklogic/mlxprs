import * as assert from 'assert';
import { after } from 'mocha';
import { window, workspace, Uri } from 'vscode';

import { defaultDummyGlobalState } from './dummyGlobalState';
import {
    testOverrideQueryWithGoodJSON, testOverrideQueryWithBadJSON, testQueryWithoutOverrides,
    testOverrideXQueryWithGoodJSON, testOverrideXQueryWithBadJSON, testXQueryWithoutOverrides,
    testOverrideSslParams
} from './testOverrideQuery';
import { MLRuntime } from '../../JSDebugger/mlRuntime';
import { AttachRequestArguments } from '../../JSDebugger/mlDebug';
import { MarklogicClient } from '../../marklogicClient';
import { QueryResultsContentProvider } from '../../queryResultsContentProvider';
import { getDbClient, parseQueryForOverrides } from '../../vscQueryParameterTools';

const SJS = 'sjs';
const XQY = 'xqy';

suite('Extension Test Suite', () => {
    after(() => {
        window.showInformationMessage('All tests done!');
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

        const firstClient: MarklogicClient = getDbClient('', SJS, config, gstate);
        firstClient.params.host = newHost;

        // Verify next client is different since firstClient's params were modified
        const secondClient: MarklogicClient = getDbClient('', SJS, config, gstate);
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
        const mlClient1: MarklogicClient = getDbClient(queryText, SJS, config, gstate);

        assert.strictEqual(overrides.host, mlClient1.params.host);
        // The pwd value in mlClient1.params will always be of type string, so have to cast the expected value
        assert.strictEqual(mlClient1.params.pwd, String(cfgPwd));
        assert.strictEqual(mlClient1.params.pathToCa, cfgPca);
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
        const provider = new QueryResultsContentProvider();
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
        const provider = new QueryResultsContentProvider();
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
