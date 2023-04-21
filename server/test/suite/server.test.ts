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
import { after, before } from 'mocha';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as completionsXqy from '../../completionsXqy';
import * as completionsSjs from '../../completionsSjs';

// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', () => {

    before(() => {
        console.debug('starting server tests!');
    });

    after(() => {
        console.debug('All server tests done!');
    });

    // Defines a Mocha unit test
    test('Something 1', () => {
        assert.equal(-1, [1, 2, 3].indexOf(5));
        assert.equal(-1, [1, 2, 3].indexOf(0));
    });

    test('getting MarkLogic namespace hints (sanity check)', () => {
        const allXqN = completionsXqy.allMlXqyNamespaces;
        assert.notEqual(allXqN, 0);
        const allSjsN = completionsSjs.allMlSjsNamespaces;
        assert.notEqual(allSjsN, 0);
    });

    test('getting MarkLogic function hints (sanity check)', () => {
        const AllXqF = completionsXqy.allMlXqyFunctions;
        assert.ok(AllXqF);
        const AllSjsF = completionsSjs.allMlSjsFunctions;
        assert.ok(AllSjsF);
    });
});
