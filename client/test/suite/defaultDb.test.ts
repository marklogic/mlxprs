import * as assert from 'assert'
import { MarklogicClient, MlClientParameters } from '../../marklogicClient'

suite('Default Documents DB Test Suite', () => {
    test('When MlClientParameters is used and the default contentDb is null', async () => {
        const mlClient = new MarklogicClient(
            new MlClientParameters({
                host: 'host',
                port: 'port',
                user: 'user',
                pwd: 'pwd',
                authType: 'DIGEST',
                contentDb: null,
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            })
        )
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null')
    })

    test('When MlClientParameters is used and the default contentDb is undefined', async () => {
        const mlClient = new MarklogicClient(
            new MlClientParameters({
                host: 'host',
                port: 'port',
                user: 'user',
                pwd: 'pwd',
                authType: 'DIGEST',
                contentDb: undefined,
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            })
        )
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null')
    })

    test('When MlClientParameters is used and the default contentDb is \'\'', async () => {
        const mlClient = new MarklogicClient(
            new MlClientParameters({
                host: 'host',
                port: 'port',
                user: 'user',
                pwd: 'pwd',
                authType: 'DIGEST',
                contentDb: '',
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            })
        )
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null')
    })

    test('When MlClientParameters is used and the default contentDb is missing', async () => {
        const mlClient = new MarklogicClient(
            new MlClientParameters({
                host: 'host',
                port: 'port',
                user: 'user',
                pwd: 'pwd',
                authType: 'DIGEST',
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            })
        )
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null')
    })

    test('When MlClientParameters is used and the default contentDb contains a value', async () => {
        const mlClient = new MarklogicClient(
            new MlClientParameters({
                host: 'host',
                port: 'port',
                user: 'user',
                pwd: 'pwd',
                authType: 'DIGEST',
                contentDb: 'someDatabase',
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            })
        )
        assert.strictEqual(mlClient.params.contentDb, 'someDatabase', 'ML client contentDb should match the input value')
    })

})
