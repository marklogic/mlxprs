//
// Note: This example test is leveraging the Mocha test framework.
// Please refer to their documentation on https://mochajs.org/ for help.
//

// The module 'assert' provides assertion methods from node
import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as myExtension from '../src/extension';
import * as completionsXqy from '../server/completionsXqy';
import * as completionsSjs from '../server/completionsSjs';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", () => {

    // Defines a Mocha unit test
    test("Something 1", () => {
        assert.equal(-1, [1, 2, 3].indexOf(5));
        assert.equal(-1, [1, 2, 3].indexOf(0));
    });

    test("getting MarkLogic namespace hints (sanity check)", () => {
        let allXqN = completionsXqy.allMlXqyNamespaces
        assert.notEqual(completionsXqy.allMlXqyNamespaces, 0)
        let allSjsN = completionsSjs.allMlSjsNamespaces
        assert.notEqual(completionsSjs.allMlSjsFunctions, 0)
    });

    test("getting MarkLogic function hints (sanity check)", () => {
        let AllXqF = completionsXqy.allMlXqyFunctions
        assert.ok(completionsXqy.allMlXqyFunctions)
        let AllSjsF = completionsSjs.allMlSjsFunctions
        assert.ok(completionsSjs.allMlSjsFunctions)
    });
});
