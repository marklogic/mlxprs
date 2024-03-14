---
layout: default
title: Launch - Debugging Local Module Evals
nav_order: 1
parent: Debugging Support
---

### Launch - Step Through Local Modules

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
An optional `program` property can be provided in a `launch.json` task configuration to specify another file for debugging.
Additionally, older versions of this extension permitted the use of `path` for JS. However, while `path` still works, its use is deprecated and will be removed in mlxprs 4.0
