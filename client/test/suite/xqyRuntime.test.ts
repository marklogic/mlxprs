import * as assert from 'assert'
import { after, before } from 'mocha'

import { window } from 'vscode'
import { testStackXml, testExprXml } from './testXqyDebugMessages'
import { XqyRuntime, XqyFrame, XqyExpr } from '../../XQDebugger/xqyRuntime'

suite('XQyuery Debug Test Suite', () => {
    let stackFrames: Array<XqyFrame>
    let expr: Array<XqyExpr>
    const stackXmlString: string = testStackXml()
    const exprXmlString: string = testExprXml()

    after(() => {
        window.showInformationMessage('All tests done!')
    })

    before(() => {
        stackFrames = XqyRuntime.parseStackXML(stackXmlString)
        expr = XqyRuntime.parseExprXML(exprXmlString)
    })

    test('parseStackXML produces XqyFrames', () => {
        assert.equal(2, stackFrames.length)
        assert.ok(stackFrames[0].operation.match(/for \$row in \$rows let/))
        assert.equal(8, stackFrames[0].line)
        assert.equal('/test-module.xqy', stackFrames[0].uri)
    })

    test('parseExprXML produces XqyExprs', () => {
        assert.equal(2, expr.length)
        assert.equal('3023757983150276589', expr[0].id)
        assert.ok( expr[0].source.match(/for \$row in \$rows let/))
        assert.ok(!expr[1].source.match(/for \$row in \$rows let/))
        assert.equal( 7, expr[0].line)
        assert.equal(10, expr[1].line)
    })

})
