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

/* eslint-disable @typescript-eslint/no-var-requires */
//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict'

const path = require('path')
const merge = require('merge-options')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
module.exports = function withDefaults(/**@type WebpackConfig*/extConfig) {

    /** @type WebpackConfig */
    const defaultConfig = {
        mode: 'none',
        target: 'node', // vscode extensions run in a Node.js-context
        // 📖 -> https://webpack.js.org/configuration/node/
        node: {
            __dirname: false
        },
        resolve: {
            mainFields: ['module', 'main'],
            extensions: ['.ts', '.js']
        },
        module: {
            rules: [{
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [{
                    loader: 'ts-loader',
                }]
            }]
        },
        devtool: 'source-map',
        externals: {
            vscode: 'commonjs vscode' // the vscode-module is created on-the-fly and must be excluded.
            // Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
        },
        output: {
            // the bundle is stored in the 'dist' folder (check package.json)
            // 📖 -> https://webpack.js.org/configuration/output/
            filename: '[name].js',
            path: path.join(extConfig.context, 'dist'),
            libraryTarget: 'commonjs',
        },
    }

    return merge(defaultConfig, extConfig)
}
