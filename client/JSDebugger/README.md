# ml-jsdebugger

This add on supports debugging javascript request running in MarkLogic server. 

## Getting started

The debugger supports two modes of debugging:

1. Launch
2. Attach

## Configuration

You will need to configure mlxpr settings in settings.json first.

To start a debug session, You'll also need a launch config (launch.json) that specifies debug-specific parameters.

### Launch
Example config:

```json
    {
        "type": "ml-jsdebugger",
        "request": "launch",
        "name": "Launch Debug Request"
    }
```
Launch mode will launch the currently opened file for debugging by default.
An optional "path" parameter cna be provided to specify another file for debug. 

### Attach
Example config:

```json
    {
        "type": "ml-jsdebugger",
        "request": "attach",
        "name": "Attach to Debug Request",
        "debugServerName": "jsdbg",
        "path": "${workspaceFolder}"
    }
```
Attach mode attahes to a paused request in a <strong>debug server<strong>. A debug server is an app server that is connected to js debugger.
To make a debug server, open command palette and type connectServer to connect. Type disconnectServer if you no longer need the debug server.
<strong>Only requests that are launched after a server is connected/made debug server can be attached.</strong>

In attach mode, debugServerName and path are required parameters. Once you start debugging,
a dropdown menu will first pop up that lists all paused requests under the debug server. Then choose the one of interest for debugging.

There is one optional parameter rid if you already have the request ID for the debuggee.

## Coming soon

We have not implemented streaming files currently, so if you import other modules in your script, you won't be able to inspect, set breakpoints in those files. Unless in attach mode, when you have a mirror copy of the modules directory or set path to the module root, you will be able to work on multiple files. This limitation will hopefully be soon addressed.






