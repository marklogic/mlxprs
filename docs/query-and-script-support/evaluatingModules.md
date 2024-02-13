---
layout: default
title: JS & XQuery Modules
nav_order: 5
parent: Executing Queries & Scripts
---

### Evaluate JavaScript & XQuery modules

To evaluate JavaScript or XQuery:

1. Open a valid module in the editor.
2. Open the VS Code command palette.
3. Select `MarkLogic: Eval JS` or `MarkLogic: Eval XQuery` - depending on the type of module.

Evaluation results will apper in the `MLXPRS: RESULTS` tab in the bottom panel, or open in a new editor tab - depending on the value of the `Marklogic: Results In Editor Tab` setting.

### Configuration Override for Module Evaluation

You can override your VS Code configured settings by using a block comment as the first language token
in a JavaScript or XQuery query. The comment should conform to the following:

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

When this query runs, it will use the host, port, and `contentDb` specified in the comment, along with the VS Code configuration parameters for the rest of the MarkLogic client definition. (The `note` will be ignored.) Other queries in other editor tabs will not be affected.

**Note: This configuration override is only applied when using one of the "MarkLogic: Eval <language>" commands.
