import * as assert from 'assert'
import { after } from 'mocha'

import { window } from 'vscode'
import { testStackXml } from './testXqyDebugMessages'
import { XqyRuntime, XqyFrame } from '../../XQDebugger/xqyRuntime'

suite('XQyuery Debug Test Suite', () => {
    after(() => {
        window.showInformationMessage('All tests done!')
    })

    test('parseStackXML produces XqyFrames', () => {
        const stackXmlString: string = testStackXml()
        const stackFrames: Array<XqyFrame> = XqyRuntime.parseStackXML(stackXmlString)
        assert.equal(2, stackFrames.length)
    })

})
