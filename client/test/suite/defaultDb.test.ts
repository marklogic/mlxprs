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

import { ClientFactory } from '../../clientFactory';

suite('Default Documents DB Test Suite', () => {
    test('When ClientFactory is used and the default contentDb is null', async () => {
        const mlClient =
            new ClientFactory({
                host: 'host',
                port: 'port',
                user: 'user',
                password: 'pwd',
                authType: 'DIGEST',
                contentDb: null,
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            }).newMarklogicRestClient();
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null');
    });

    test('When ClientFactory is used and the default contentDb is undefined', async () => {
        const mlClient =
            new ClientFactory({
                host: 'host',
                port: 'port',
                user: 'user',
                password: 'pwd',
                authType: 'DIGEST',
                contentDb: undefined,
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            }).newMarklogicRestClient();
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null');
    });

    test('When MlClientParameters is used and the default contentDb is \'\'', async () => {
        const mlClient =
            new ClientFactory({
                host: 'host',
                port: 'port',
                user: 'user',
                password: 'pwd',
                authType: 'DIGEST',
                contentDb: '',
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            }).newMarklogicRestClient();
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null');
    });

    test('When MlClientParameters is used and the default contentDb is missing', async () => {
        const mlClient =
            new ClientFactory({
                host: 'host',
                port: 'port',
                user: 'user',
                password: 'pwd',
                authType: 'DIGEST',
                modulesDb: 'modulesDb',
                ssl: 'ssl',
                rejectUnauthorized: 'rejectUnauthorized'
            }).newMarklogicRestClient();
        assert.strictEqual(mlClient.params.contentDb, null, 'ML client contentDb should be null');
    });

    test('When ClientFactory is used and the default contentDb contains a value', async () => {
        const params = {
            host: 'host',
            port: 'port',
            user: 'user',
            password: 'pwd',
            authType: 'DIGEST',
            contentDb: 'someDatabase',
            modulesDb: 'modulesDb',
            ssl: 'ssl',
            rejectUnauthorized: 'rejectUnauthorized'
        };
        const clientFactory = new ClientFactory(params);
        const mlClient = clientFactory.newMarklogicRestClient();
        assert.strictEqual(mlClient.params.contentDb, 'someDatabase', 'ML client contentDb should match the input value');
    });

});
