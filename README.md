# MarkLogic Extension for Visual Studio Code

_Develop, run, and debug code for MarkLogic in the popular VS Code IDE_

[Visual Studio Code](https://code.visualstudio.com) is a free, cross-platform code editor and development tool from Microsoft. The free, open-source [**MarkLogic extension for VS Code**](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs) integrates MarkLogic in the cloud or on your laptop into this modern development environment.

## Features

* Syntax highlighting and IntelliSense for MarkLogic Server-Side JavaScript and XQuery
* Interactive debugging of JavaScript and XQuery running in Data Hub Service or MarkLogic, including attaching to in-flight requests and inspecting live variables
*  Real-time query evaluation of JavaScript or XQuery against a live Data Hub Service or MarkLogic instance

_JavaScript debugging requires version 2.0.0+ of the MarkLogic extension and [MarkLogic 10.0-4+](https://developer.marklogic.com/products/marklogic-server/10.0)._


## Getting started

Install this tool using the VS Code built-in [marketplace](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs). Search “MarkLogic” from the Extension tab of the activity bar. Click “Install” to download and install the extension.

### Configuration

The MarkLogic extension exposes several configuration options from the standard VS Code `settings.json` file (<kbd>Cmd</kbd>-<kbd>,</kbd>),

```json
{
    "marklogic.host": "marklogic-instance.geocities.com",
    "marklogic.port": 8040,
    "marklogic.username": "username",
    "marklogic.password": "****************",
    "marklogic.documentsDb": "myproject-content",
    "marklogic.modulesDb": "myproject-modules"
}
```

You can also set `marklogic.authType` to `DIGEST` or `BASIC`. Digest is the default,
and works even if the server is running basic authentication.

### Connect and query

To evaluate JavaScript

1. Type a valid JavaScript query in the editor.
2. Open the command palette (<kbd>Shift</kbd>+<kbd>Cmd</kbd>+<kbd>P</kbd>)
3. Select `MarkLogic: Eval JS`

Query results will open in a new document in the current workspace. 

### SSL Configuration

You can turn on SSL with the `marklogic.ssl` configuration property.
If the CA is not in your chain of trust (for example, if the certificate is self-signed),
you need to point to the CA in your configuration as well using `marklogic.pathToCa`.
The configuration will look something like this:

```json
{
    "marklogic.ssl": true,
    "marklogic.pathToCa": "/Users/myself/certs/my.own.ca.crt"
}
```

You can acquire the CA file from the MarkLogic admin pane (usually port 8001), by
going to 'Security' -> 'Certificate Templates' -> (cert host name), and then
selecting the "Status" tab. There is an "download" button in the "certificate template status"
section. Click the "download" button to download a copy of your root CA.

### Per-query configuration override 

You can override your VS Code configured settings by using a block comment as the first language token
in the query. The comment should conform to the following:

- First line includes the string `mlxprs:settings`
- The rest of the comment is valid JSON
- Includes at least one of the following keys: `host`, `port`, `user`, `pwd`, `contentDb`, `modulesDb`, `authType`, `ssl`, `pathToCa`
- The corresponding value should be of the right type for the configuration (number for `port`, boolean for `ssl`, string otherwise)

The values defined in the JSON will override VS Code's MarkLogic client configuration.

For example:

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

or:

```xquery
(: mlxprs:settings
{
  "host": "my-test-host",
  "contentDb": "unit-test-database",
  "modulesDb": "unit-test-MODULES",
  "user": "unit-tester",
  "pwd": "red,green,refactor",
  "note": "These settings are for testing only"
}
:)
xquery version "1.0-ml";
fn:doc('/my-testing-doc.json')
```

When this query runs, it will use the host, port, and `contentDb` specified in the comment, along with the VS Code configuration parameters for the rest of the MarkLogic client definition. (The "note" will be ignored.) Other queries in other editor tabs will not be affected.

## Debugging

Both JavaScript and XQuery debuggers support two modes of debugging:

1. Launch: Evaluates a main module (for JavaScript) or non-library module (for XQuery)
2. Attach: Intecepts an existing request, such as from an integration test

Where it can, query debugging uses the same VS Code settings used for running queries (for example, `marklogic.host`, `marklogic.username`). In addition to these code settings, you will need a [**launch config**](https://code.visualstudio.com/docs/editor/debugging#_launch-configurations) in your project (under `.vscode/launch.json`) for debug-specific parameters.

Open the `launch.json` from the VS Code command palette with the command: “Debug: Open launch.json” or "Debug.

Below is an example of a `launch.json` file, with JavaScript and XQuery configurations for both launch and attach:

```json
{
  "version": "2.0.0",
  "configurations": [
    {
      "request": "launch",
      "type": "ml-jsdebugger",
      "name": "Evaluate Current JavaScript Module"
    },
    {
      "request": "attach",
      "type": "ml-jsdebugger",
      "name": "Attach to Debug Request",
      "path": "${workspaceFolder}/src/main/ml-modules/root",
      "debugServerName": "Enter debug server name"
    },
    {
      "request": "launch",
      "type": "xquery-ml",
      "name": "Launch XQY Debug Request",
      "program": "",
      "root": "${workspaceFolder}/src/main/ml-modules/root"
    },
    {
      "request": "attach",
      "type": "xquery-ml",
      "name": "Attach to XQY Debug request",
      "root": "${workspaceFolder}/plugins"
    }
  ]
}
```

VS Code is syntax-aware of what information should go into `launch.json`, so take advantage of auto-complete and hover hints as you edit.

### Launch

Example 'launch' type configuration items for JavaScript and XQuery:

```json
    {
      "type": "ml-jsdebugger",
      "request": "launch",
      "name": "Evaluate Current JavaScript Module"
    },
    {
      "type": "xquery-ml",
      "request": "launch",
      "name": "Launch XQY Debug Request",
      "program": "",
      "root": "${workspaceFolder}/src/main/ml-modules/root"
    }
```

By default, launch mode will launch the currently opened file for debugging.
An optional "path" (for JavaScript) or "program" (for XQuery) can be provided to specify another file for debugging.

### Attach

Here's an example of _attach_ configurations for JavaScript and XQuery:

```json
    {
      "type": "ml-jsdebugger",
      "request": "attach",
      "name": "Attach to Remote JavaScript Request",
      "debugServerName": "jsdbg",
      "path": "${workspaceFolder}/src/main/ml-modules/root"
    },
    {
      "type": "xquery-ml",
      "request": "attach",
      "name": "Attach to XQY Debug request",
      "root": "${workspaceFolder}/plugins"
    }
```

Attach mode intercepts a paused request in a given *debug server*, an app server connected to the VS Code debugger. To connect to an app server for debugging:

1. open the command palette, start typing <kbd>MarkLogic: Connect...</kbd> until autocomplete prompts you with "MarkLogic: Connect JavaScript Debug Server" or "MarkLogic: Connect XQuery Debug Server", and choose the command you want.
2. You'll be prompted to choose a server. Use the name of the app server in the MarkLogic configuration, _not_ its hostname or IP address.
3. You should see a confirmation message once you're connected

Connecting a server will automatically pause all requests so that you can attach the debugger. When you're done, use either <kbd>MarkLogic: Disconnect...</kbd> command to disable debugging and resume handling requests as normal.

**Note: Only requests that are launched after a server is connected/made debug server can be attached.**

Once you start debugging, a dropdown menu will pop up listing all paused requests on the debug server. Choose the one you want to debug.

![Attach screenshot](images/attach_screenshot.png "attach screenshot")

Use the optional parameter `rid` to specify a request ID in advance and avoid being prompted for it.

In attach mode for JavaScript, `debugServerName` is a required parameter in the `launch.json`. This should be the same server (by name) that you connected to in the [Attach](#attach) section. XQuery attach mode will simply list all attachable queries.



## Notes

### Debugger module mapping

In order to step through modules that get imported in your code, you need to tell the debugger where to find the modules root in your local project. This is the `path` parameter (for JavaScript) and `root` (for XQuery). These parameters are required.

### Debugging Limitations

Both debuggers assume you have a local copy of the modules you are debugging. Streaming source files from the MarkLogic is not yet implemented. If you import project-external modules into your script, you won't be able to inspect or set breakpoints in those files.



### Required Privileges for Evaluation and Debugging

To run queries with the MarkLogic JavaScript and XQuery Debugger, a user will need eval priviliges on your MarkLogic server. These include:

- **xdmp-eval**: absolute minimum
- **xdmp-eval-in**: to use a non-default content database
- **xdmp-eval-modules-change**: to use a non-default modules database or modules root
- **xdmp-eval-modules-change-file**: to use the filesystem for modules

For debugging, a user must also have at least one of these privileges:

- **debug-my-request**: for debugging requests launched by the debug user only
- **debug-any-request**: for debugging requests launched by any user

For more about privileges, see [xdmp:eval](https://docs.marklogic.com/10.0/xdmp:eval) and [Debug functions](https://docs.marklogic.com/dbg) in the API docs, along with [Pre-defined Executive Privileges](https://docs.marklogic.com/guide/admin/exec_privs) in the MarkLogic server documentation. 

## Credit

Aside from excellent development and extension support from Visual Studio Code,

- Portions of Josh Johnson's [vscode-xml](https://github.com/DotJoshJohnson/vscode-xml) project are re-used
for XML formatting. The MIT license and source code are kept in the `client/xmlFormatting` folder of this project.
- Christy Haragan's [marklogic-node-typescript-definitions](https://github.com/christyharagan/ml-typescript-definitions)
made this project possible.
- Paxton Hare's [marklogic-sublime](https://github.com/paxtonhare/MarkLogic-Sublime)
`xquery-ml.tmLanguage` code is used for XQuery-ML syntax and snippets, and the MarkLogic Sublime project inspired this one.
