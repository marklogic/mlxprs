import * as assert from 'assert'
import { after, before } from 'mocha'

import { window } from 'vscode'
import { testStackXml } from './testXqyDebugMessages'
import { XqyRuntime, XqyFrame } from '../../XQDebugger/xqyRuntime'

suite('XQyuery Debug Test Suite', () => {
    let stackFrames: Array<XqyFrame>
    const stackXmlString: string = testStackXml()

    after(() => {
        window.showInformationMessage('All tests done!')
    })

    before(() => {
        stackFrames = XqyRuntime.parseStackXML(stackXmlString)
    })

    test('parseStackXML produces XqyFrames', () => {
        assert.equal(2, stackFrames.length)
        assert.ok(stackFrames[0].operation.match(/for \$row in \$rows let/))
        assert.equal(8, stackFrames[0].line)
        assert.equal('/test-module.xqy', stackFrames[0].uri)
    })

})
