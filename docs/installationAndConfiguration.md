---
layout: default
title: Installation & Configuration
nav_order: 2
---

Install this extension using the VS Code built-in [marketplace](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs). Search “MarkLogic” from the Extension tab of the activity bar. Click “Install” to download and install the extension.



The MarkLogic extension may be configured in the VS Code Settings. To open the VS Code Settings editor, choose "Settings..." under the "Code" menu, and then choose "Settings". Once the Settings editor is open, type "MarkLogic" into the search bar. You can also change the configuration settings just for the workspace by adding the values to the `settings.json` file in the .vscode directory of your workspace.

```json
{
  "marklogic.host": "marklogic-instance.geocities.com",
  "marklogic.port": 8040,
  "marklogic.managePort": 8002,
  "marklogic.testPort": 8054,
  "marklogic.username": "username",
  "marklogic.password": "****************",
  "marklogic.documentsDb": "myproject-content",
  "marklogic.modulesDb": "myproject-modules"
}
```
**Note: marklogic.documentsDb *must* be declared in order to attach to remote JavaScript request.

You can also set `marklogic.authType` to `DIGEST` or `BASIC`. Digest is the default,
and works even if the server is running basic authentication.