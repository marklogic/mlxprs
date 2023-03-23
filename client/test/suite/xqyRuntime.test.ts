import * as assert from 'assert';
import { after, before } from 'mocha';

import { window } from 'vscode';
import { testStackXml, testExprXml, testLargerStackXml } from './testXqyDebugMessages';
import { XqyRuntime, XqyFrame, XqyExpr } from '../../XQDebugger/xqyRuntime';

suite('XQyuery Debug Test Suite', () => {
    let stackFrames: Array<XqyFrame>;
    let largerStackFrames: Array<XqyFrame>;
    let expr: Array<XqyExpr>;
    const stackXmlString: string = testStackXml();
    const largerStackXmlString: string = testLargerStackXml();
    const exprXmlString: string = testExprXml();

    after(() => {
        window.showInformationMessage('All tests done!');
    });

    before(() => {
        stackFrames = XqyRuntime.parseStackXML(stackXmlString);
        largerStackFrames = XqyRuntime.parseStackXML(largerStackXmlString);
        expr = XqyRuntime.parseExprXML(exprXmlString);
    });

    test('parseStackXML produces XqyFrames', () => {
        assert.equal(3, stackFrames.length);
        assert.ok(stackFrames[0].operation.match(/for \$row in \$rows let/));
        assert.equal(8, stackFrames[0].line);
        assert.equal('/test-module.xqy', stackFrames[0].uri);
        assert.equal('9444875716397283355', stackFrames[0].xid);
    });

    test('parseStackXML produces usable stack', () => {
        assert.equal(4, largerStackFrames.length);
    });

    test('parseStackXML produces usable scopeChain', () => {
        assert.equal(4, largerStackFrames[0].scopeChain[0].variables.length);
        assert.equal('global', largerStackFrames[0].scopeChain[0].type);
        assert.equal(5, largerStackFrames[3].scopeChain[0].variables.length);
    });

    test('parseStackXML scopeChains include usable variables', () => {
        assert.equal(1, largerStackFrames[3].scopeChain.length);
        assert.equal(2, largerStackFrames[2].scopeChain.length);
        assert.equal('local', largerStackFrames[2].scopeChain[1].type);
    });

    test('parseStackXML exposes variable values when available', () => {
        assert.ok(largerStackFrames[2].scopeChain[1].variables[1].value);
        assert.ok(largerStackFrames[2].scopeChain[1].variables[0].value);
        assert.equal('map:map()', largerStackFrames[2].scopeChain[1].variables[1].value);

        assert.ok(!largerStackFrames[3].scopeChain[0].variables[0].value);
    });

    test('parseStackXML uses local variables from first frame when available', () => {
        assert.equal(2, largerStackFrames[0].scopeChain.length);
        assert.ok(largerStackFrames[0].scopeChain.map(scope => {return scope.type;}).includes('local'));
    });

    test('parseExprXML produces XqyExprs', () => {
        assert.equal(2, expr.length);
        assert.equal('3023757983150276589', expr[0].id);
        assert.ok(expr[0].source.match(/for \$row in \$rows let/));
        assert.ok(!expr[1].source.match(/for \$row in \$rows let/));
        assert.equal(7, expr[0].line);
        assert.equal(10, expr[1].line);
    });

});
