[![](https://vsmarketplacebadges.dev/version/mlxprs.mlxprs.png)](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs)
[![](https://vsmarketplacebadges.dev/installs-short/mlxprs.mlxprs.png)](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs)
[![](https://vsmarketplacebadges.dev/rating-short/mlxprs.mlxprs.png)](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs)

# MLXPRS: MarkLogic Extension for Visual Studio Code

_Develop, run, and debug code for MarkLogic in the popular VS Code IDE_

[Visual Studio Code](https://code.visualstudio.com), also known as VS Code, is a free, cross-platform code editor and development tool from Microsoft. [**MLXPRS**](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs) is a free, open-source extension for VS Code that increases the productivity of developers creating applications on MarkLogic.

## Features

* Syntax highlighting and IntelliSense for MarkLogic Server-Side JavaScript and XQuery
* Interactive debugging of JavaScript and XQuery running in MarkLogic, including attaching to in-flight requests and inspecting live variables
* Real-time query evaluation of JavaScript, XQuery, SQL, SPARQL, Optic, and GraphQL against a MarkLogic instance
* View modules (read-only) in the editor
* Run [marklogic-unit-test module](https://github.com/marklogic-community/marklogic-unit-test)
* Validate TDE templates and test the templates with node extraction
* View high-level information about the currently connected MarkLogic server

_JavaScript debugging requires version 2.0.0+ of the MarkLogic extension and [MarkLogic 10.0-4+](https://developer.marklogic.com/products/marklogic-server/10.0)._


## Getting started

Install this tool using the VS Code built-in [marketplace](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs). Search “MarkLogic” from the Extension tab of the activity bar. Click “Install” to download and install the extension.

For more information on installation, configuration and usage, please see [the User Guide](https://marklogic.github.io/mlxprs/).

## Credit

Aside from excellent development and extension support from Visual Studio Code,

- Portions of Josh Johnson's [vscode-xml](https://github.com/DotJoshJohnson/vscode-xml) project are re-used
for XML formatting. The MIT license and source code are kept in the `client/xmlFormatting` folder of this project.
- Christy Haragan's [marklogic-node-typescript-definitions](https://github.com/christyharagan/ml-typescript-definitions)
made this project possible.
- Paxton Hare's [marklogic-sublime](https://github.com/paxtonhare/MarkLogic-Sublime)
`xquery-ml.tmLanguage` code is used for XQuery-ML syntax and snippets, and the MarkLogic Sublime project inspired this one.
