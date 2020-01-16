# mlxprs

*A MarkLogic Visual Studio Code extension*

This extension allows you to run Server-side JavaScript (SJS) and XQuery Queries against a MarkLogic database.
It also adds syntax highlighting for the MarkLogic XQuery (`version "1.0-ml"`) dialect.

## What it does

The extension adds two commands to the VS Code command palette:

1. Eval JavaScript
2. Eval XQuery

This will take the contents of the current active editor window and run it against a configured MarkLogic database instance.
The results of the query will be shown in the next tab over.

## Features

- It's asynchronous: long-running queries won't freeze the editor
- Changes to the config file take immediate effect, switch databases and credentials on-the-fly
- Readability—pretty-formatting of query results based on their contents
- SJS and XQuery code completion with functions from the MarkLogic API

## Coming soon (hopefully)

- Code completion with user-defined functions (locally or in the configured modules database)
- Edit MarkLogic XML and JSON documents in the text editor, save them back to the database

## Getting started

The easiest way to install this is to use VS Code's built-in marketplace. Search for "mlxprs" or "MarkLogic", and then simply click "install" when you find this extension.

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

You can also set `marklogic.authType` to `DIGEST` or `BASIC`. DIGEST is default,
and appears to work even if the server is running BASIC authentication.

### Connect and query

If you're running MarkLogic on localhost:8000 admin/admin, and want to query the "Documents" database,
simply:

1. type a valid SJS query in the editor,
2. open the command palette (`[Shift]`+`[Cmd]`+`[P]`),
3. type "MarkLogic: Eval JS", or better yet, let the command palette autocomplete it.

If your query can be completed, it will open a new tab and output the results there.
If not, the error message will be shown.

### SSL Configuration

You can turn on SSL with the `marklogic.ssl` configuration property.
If the CA is not in your chain of trust (e.g. if the certificate is self-signed),
you need to point to it in your configuration as well, using `marklogic.pathToCa`.
It will look something like this:

```json
{
    "marklogic.ssl": true,
    "marklogic.pathToCa": "/Users/myself/certs/my.own.ca.crt"
}
```

You can acquire the CA file from MarkLogic's admin panel (usually port 8001), by
going to 'Security' -> 'Certificate Templates' -> (cert host name), and then
selecting the "Status" tab. There is an "download" button in the "certificate template status"
section. Click that button to download a copy of your root CA.

### Per-query configuration override 

You can override your VS Code configured settings by using a block comment as the first language token
in the query. The comment should conform to the following:

- first line includes the string `mlxprs:settings`
- the rest of the comment is valid JSON
- at least one of the following keys: `host`, `port`, `user`, `pwd`, `contentDb`, `modulesDb`, `authType`, `ssl`, `pathToCa`.
- the corresponding value should be the right type for the configuration (number for `port`, boolean for `ssl`, string otherwise)

The values defined in the JSON will override VS Code's MarkLogic client configuration.

e.g.:

```js
/* mlxprs:settings
{
  "host": "my-test-host",
  "port": 8079,
  "contentDb": "unit-test-database",
  "note": "These settings are for testing only"
}
*/
'use strict';
cts.doc('/my-testing-doc.json');
```

```xquery
(:
/* mlxprs:settings
{
  "host": "my-test-host",
  "contentDb": "unit-test-database",
  "modulesDb": "unit-test-MODULES",
  "user": "admin",
  "pwd": "admin",
  "note": "Thhese settings are for testing only"
}
*/
:)
xquery version "1.0-ml";
fn:doc('/my-testing-doc.json')
```

When this query runs, it will use the host, port and contentDb specified in the comment, along with the VS Code
configuration parameters for the rest of the MarkLogic client definition. (The "note" will be ignored.). Other queries in other editor tabs will not be affected.



## Requirements

I've been building and testing with the following ingredients:

- MarkLogic 10, with admin access
- Visual Studio Code, version 1.36.1
- `npm` version 6.9.0
- node.js v11.13.0

## Credit

Aside from excellent development and extension support from Visual Studio Code,

- Portions of Josh Johnson's [vscode-xml](https://github.com/DotJoshJohnson/vscode-xml) project are re-used
for XML formatting. The MIT license and source code are kept in the `client/xmlFormatting` folder of this project.
- Christy Haragan's [marklogic-node-typescript-definitions](https://github.com/christyharagan/ml-typescript-definitions)
made this project possible.
- Paxton Hare's [marklogic-sublime](https://github.com/paxtonhare/MarkLogic-Sublime)
`xquery-ml.tmLanguage` code is used for XQuery-ML syntax and snippets, and the MarkLogic Sublime project inspired this one.
