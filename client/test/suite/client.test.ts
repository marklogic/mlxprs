import * as assert from 'assert'
import { after } from 'mocha'

import { window, workspace } from 'vscode'
import { defaultDummyGlobalState } from './dummyGlobalState'
import { getDbClient, MarklogicVSClient } from '../../marklogicClient'

suite('Extension Test Suite', () => {
    after(() => {
        window.showInformationMessage('All tests done!')
    })

    test('getDbClient should cache its settings in the state passed to it', () => {
        const config = workspace.getConfiguration()
        const gstate = defaultDummyGlobalState()
        const newHost: string = Math.random().toString(36)

        // get the client and differentiate it from the one in gstate by host
        let mlClient1: MarklogicVSClient = getDbClient(config, gstate)
        mlClient1.host = newHost

        // get a second client, should not be the same or deepequal to first
        const mlClient2: MarklogicVSClient = getDbClient(config, gstate)
        assert.notEqual(mlClient1, mlClient2)
        assert.notDeepStrictEqual(mlClient1, mlClient2)

        // getting mlClient1 from getDbClient should overwrite with the exact
        // same instance as mlClient2
        mlClient1 = getDbClient(config, gstate)
        assert.equal(mlClient1, mlClient2)
        assert.notEqual(mlClient1.host, newHost)
    })

    test('Sample test', () => {
        assert.equal(-1, [1, 2, 3].indexOf(5))
        assert.equal(-1, [1, 2, 3].indexOf(0))
    })
})
