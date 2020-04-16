/* eslint-disable @typescript-eslint/no-var-requires */
//@ts-check

'use strict'

const withDefaults = require('./shared.webpack.config')
const path = require('path')

module.exports = withDefaults({
    context: path.join(__dirname),
    entry: {
        extension: './client/extension.ts',
        xqyDebug: './serverXqyDbg/xqyDebug.ts',
        jsDebug: './client/JSDebugger/mlDebug.ts'
    }
})
