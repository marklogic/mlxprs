---
layout: default
title: Debugging Support
nav_order: 6
has_children: true
permalink: /docs/debugging-support
---

## Debugging

Both JavaScript and XQuery debuggers support two modes of debugging:

1. Launch: Evaluates a main module (for JavaScript) or non-library module (for XQuery)
2. Attach: Intecepts an existing request, such as from an integration test

Where it can, query debugging uses the same VS Code settings used for running queries (for example, `marklogic.host`, `marklogic.username`). In addition to these code settings, you will need a [**launch config**](https://code.visualstudio.com/docs/editor/debugging#_launch-configurations) in your project (under `.vscode/launch.json`) for debug-specific parameters.

Open the `launch.json` from the VS Code command palette with the command: “Debug: Open launch.json” or `Debug`.

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
      "root": "${workspaceFolder}/src/main/ml-modules/root",
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

### Required Privileges for Evaluation and Debugging

To run queries with the MarkLogic JavaScript and XQuery Debugger, a user will need eval priviliges on your MarkLogic server. These include:

- **xdmp-eval**: absolute minimum
- **xdmp-eval-in**: to use a non-default content database
- **xdmp-eval-modules-change**: to use a non-default modules database or modules root
- **xdmp-eval-modules-change-file**: to use the filesystem for modules

For debugging, a user must also have at least one of these privileges to evaluate a JavaScript or XQuery module in debug mode.

- **debug-my-requests**: for debugging requests launched by the debug user only
- **debug-any-requests**: for debugging requests launched by any user

If a user wants to attach to paused requests within a MarkLogic App Server, in order to debug requests, they must have the **debug-any-requests** privilege.

For more about privileges, see [xdmp:eval](https://docs.marklogic.com/10.0/xdmp:eval) and [Debug functions](https://docs.marklogic.com/dbg) in the API docs, along with [Pre-defined Executive Privileges](https://docs.marklogic.com/guide/admin/exec_privs) in the MarkLogic server documentation.
