# mlxprs

*A MarkLogic Visual Studio Code extension*

This extension allows you to run XQuery and JavaScript Queries against a MarkLogic database.
It also adds syntax highlighting for the MarkLogic XQuery (`version "1.0-ml"`) dialect.
It's still very much a work in progress.

## What it does

The extension adds two commands to the VS Code command palette:

1. Eval XQuery
2. Eval JavaScript

This will take the contents of the current active editor window and run it against a configured MarkLogic database instance.
The results of the query will be shown in the next tab over.

## Features

- It's asynchronous: long-running queries won't freeze the editor
- Changes to the config file take immediate effect, switch databases and credentials on-the-fly
- Readability—pretty-formatting of query results based on their contents

## Coming soon (hopefully)

- Edit MarkLogic XML and JSON documents in the text editor, save them back to the database
- Interactive selection of configuration options
- Code completion, maybe even with custom modules out of the configured modules database

## Getting started

Use the Visual Studio Code extension manager to install the extension from the VS Code Marketplace. Search for "mlxprs".

### Manual installation

After cloning the project, the following steps should enable the extension.

1. Copy or symlink the root of this project (the `mlxprs` folder) into your VSCode extensions folder:
    - at `$HOME/.vscode/extensions/` for *nix,
    - or `%USERPROFILE%\.vscode\extensions` for Windows.
2. In the root of this project run: `npm install`
3. Then run `node ./node_modules/vscode/bin/compile`
4. Restart VSCode if it was running


### Connect and query

If you're running MarkLogic on localhost:8000 admin/admin, and want to query the "Documents" database,
simply:

1. type some valid XQuery in the editor,
2. open the command palette (`[Shift]`+`[Cmd]`+`[P]`),
3. type "MarkLogic: Eval XQuery", or better yet, let the command palette autocomplete it.

If your query can be completed, it will open a new tab and output the results there.
If not, you'll get an error message up top.

### Configuration

If you're prudently running with less trivial connection credentials,
simply define the variables in your `settings.json` file (`[Cmd]`-`[,]`),
for example:

```json
{
    "marklogic.host": "marklogic-instance.geocities.com",
    "marklogic.port": 8040,
    "marklogic.username": "admin-username",
    "marklogic.password": "4DM|Ñ-πå55'.'.'0®∂",
    "marklogic.documentsDb": "myproject-content",
    "marklogic.modulesDb": "myproject-modules"
}
```

## Requirements

I've been building and testing with the following ingredients:

- MarkLogic 8, with admin access
- Visual Studio Code, version 1.8
- `npm` version 3.10.9
- node.js v7.2.1

## Credit

Aside from excellent development and extension support from Visual Studio Code,

- Portions of Josh Johnson's [vscode-xml](https://github.com/DotJoshJohnson/vscode-xml) project are re-used
for XML formatting. The MIT license and source code are kept in the `src/xmlFormatting` folder of this project.
- Christy Haragan's [marklogic-node-typescript-definitions](https://github.com/christyharagan/marklogic-node-typescript-definitions)
made this project possible.
- Paxton Hare's [marklogic-sublime](https://github.com/paxtonhare/MarkLogic-Sublime)
`xquery-ml.tmLanguage` code is used for XQuery-ML syntax, and the MarkLogic Sublime project inspired this one.
