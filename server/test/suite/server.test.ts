import * as assert from 'assert'
import { after, before } from 'mocha'

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as completionsXqy from '../../completionsXqy'
import * as completionsSjs from '../../completionsSjs'

// Defines a Mocha test suite to group tests of similar kind together
suite('Extension Tests', () => {

    before(() => {
        console.log('starting tests!')
    })

    after(() => {
        console.log('All tests done!')
    })

    // Defines a Mocha unit test
    test('Something 1', () => {
        assert.equal(-1, [1, 2, 3].indexOf(5))
        assert.equal(-1, [1, 2, 3].indexOf(0))
    })

    test('getting MarkLogic namespace hints (sanity check)', () => {
        const allXqN = completionsXqy.allMlXqyNamespaces
        assert.notEqual(allXqN, 0)
        const allSjsN = completionsSjs.allMlSjsNamespaces
        assert.notEqual(allSjsN, 0)
    })

    test('getting MarkLogic function hints (sanity check)', () => {
        const AllXqF = completionsXqy.allMlXqyFunctions
        assert.ok(AllXqF)
        const AllSjsF = completionsSjs.allMlSjsFunctions
        assert.ok(AllSjsF)
    })
})
