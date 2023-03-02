import * as assert from 'assert'
import { workspace } from 'vscode'
import * as vscode from 'vscode';
import { defaultDummyGlobalState } from './dummyGlobalState'
import { MarklogicClient } from '../../marklogicClient'
import { getDbClient } from '../../vscQueryParameterTools'

const SJS = 'sjs'

suite('Default Documents DB Test Suite', () => {
    test('When the default database setting is blank, the contentDB property should be null', async () => {
        await workspace.getConfiguration().update('marklogic.documentsDb', undefined, vscode.ConfigurationTarget.Global)
        const config = workspace.getConfiguration()
        const gstate = defaultDummyGlobalState()
        const firstClient: MarklogicClient = getDbClient('', SJS, config, gstate)
        assert.strictEqual(firstClient.params.contentDb, null)
    })

    test('When the default database setting is blank, the contentDB property should be null', async () => {
        await workspace.getConfiguration().update('marklogic.documentsDb', void 0, vscode.ConfigurationTarget.Global)
        const config = workspace.getConfiguration()
        const gstate = defaultDummyGlobalState()
        const firstClient: MarklogicClient = getDbClient('', SJS, config, gstate)
        assert.strictEqual(firstClient.params.contentDb, null)
    })

    test('When the default database setting is populated, the contentDB property should match', async () => {
        await workspace.getConfiguration().update('marklogic.documentsDb', 'SomeUserContent', vscode.ConfigurationTarget.Global)
        const config = workspace.getConfiguration()
        const gstate = defaultDummyGlobalState()
        const firstClient: MarklogicClient = getDbClient('', SJS, config, gstate)
        assert.strictEqual(firstClient.params.contentDb, 'SomeUserContent')
    })
})
