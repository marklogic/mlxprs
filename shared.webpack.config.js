//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

'use strict';

const path = require('path');
const merge = require('merge-options');

module.exports = function withDefaults(/**@type WebpackConfig*/extConfig) {

	/** @type WebpackConfig */
	let defaultConfig = {
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
					options: {
						compilerOptions: {
							"sourceMap": true,
						}
					}
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
			path: path.join(extConfig.context, 'out'),
			libraryTarget: "commonjs",
		},
	};

	return merge(defaultConfig, extConfig);
};
