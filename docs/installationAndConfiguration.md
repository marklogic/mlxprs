---
layout: default
title: Installation & Configuration
nav_order: 2
---

### Installation

Install this extension using the VS Code built-in [marketplace](https://marketplace.visualstudio.com/items?itemName=mlxprs.mlxprs).
Search “MarkLogic” from the Extension tab of the activity bar. Click “Install” to download and install the extension.


### Configuration

The MarkLogic extension may be configured in the VS Code Settings. To open the VS Code Settings editor, choose "Settings..." under the "Code" menu, and then choose "Settings". Once the Settings editor is open, type "MarkLogic" into the search bar. You can also change the configuration settings just for the workspace by adding the values to the `settings.json` file in the .vscode directory of your workspace.

##### Direct Connection Configuration Example
```json
{
    "marklogic.host": "localhost",
    "marklogic.ssl": false,
    "marklogic.authType": "DIGEST",
    "marklogic.adminPort": 8001,
    "marklogic.adminBasePath": "",
    "marklogic.managePort": 8002,
    "marklogic.manageBasePath": "",
    "marklogic.port": 8040,
    "marklogic.restBasePath": "",
    "marklogic.testPort": 8041,
    "marklogic.testBasePath": "",
    "marklogic.username": "username",
    "marklogic.password": "****************",
    "marklogic.documentsDb": "myproject-content",
    "marklogic.modulesDb": "myproject-modules"
}
```


##### Reverse Proxy Connection Configuration Example
```json
{
    "marklogic.host": "proxyServer",
    "marklogic.ssl": false,
    "marklogic.authType": "BASIC",
    "marklogic.port": 8020,
    "marklogic.restBasePath": "/mlxprs/rest",
    "marklogic.managePort": 8020,
    "marklogic.manageBasePath": "/mlxprs/manage",
    "marklogic.testPort": 8020,
    "marklogic.testBasePath": "/mlxprs/test",
    "marklogic.adminPort": 8001,
    "marklogic.adminBasePath": "",
    "marklogic.username": "username",
    "marklogic.password": "****************",
    "marklogic.documentsDb": "myproject-content",
    "marklogic.modulesDb": "myproject-modules"
}
```


##### MarkLogic Cloud Connection Configuration Example
```json
{
    "marklogic.host": "support.test.marklogic.cloud",
    "marklogic.ssl": true,
    "marklogic.authType": "CLOUD",
    "marklogic.apiKey": "XXXXXXXXX",
    "marklogic.port": 443,
    "marklogic.restBasePath": "/ml/test/marklogic/myproject",
    "marklogic.managePort": 443,
    "marklogic.manageBasePath": "/ml/test/marklogic/manage",
    "marklogic.testPort": 443,
    "marklogic.testBasePath": "",
    "marklogic.adminPort": 443,
    "marklogic.adminBasePath": "/ml/test/marklogic/0/admin",
    "marklogic.documentsDb": "myproject-content",
    "marklogic.modulesDb": "myproject-modules"
}
```

**Note: marklogic.documentsDb must be declared in order to attach to remote JavaScript request.**

You can also set `marklogic.authType` to `DIGEST` or `BASIC`. Digest is the default,
and works even if the server is running basic authentication.

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
selecting the `Status` tab. There is a `download` button in the `certificate template status` section. Click the `download` button to download a copy of your root CA.

Alternatively, you can turn off client certificate checks altogether.
Set `marklogic.rejectUnauthorized` to `false` in your VS Code configuration.
This is less secure, but may be useful for situations where you can't obtain or use a your own CA,
such as when connecting to a IP address rather than a hostname.

Testing with some versions of VS Code has shown that if the project has a file named build.gradle and the VS Code Java Extension is enabled, the `marklogic.rejectUnauthorized` setting may be ignored. If you see this behavior, disabling the Java Extension is recommended to ensure the setting works properly. 

**Note: Currently, all configured ports (port, managePort, and testPort) must have the same SSL settings and they must either use certs that pass the configured CA verification or have CA verification turned off.**
