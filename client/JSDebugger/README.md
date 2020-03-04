# ml-jsdebugger

This add on supports debugging javascript request running in MarkLogic server. 

## Getting started

The debugger supports two modes of debugging:

1. Launch
2. Attach

## Configuration

You will need a launch config (launch.json) set up before starting debugging. A launch config specifies 
modes of debugging, connection and credential info. If not provided, the debugger defaults to settings in
mlxpr. 

### Launch
Example config:

```json
    {
        "type": "ml-jsdebugger",
        "request": "launch",
        "name": "Launch Debug Request",
        "hostname": "localhost"
    }
```

Launch mode will launch the currently opened file for debugging. 

### Attach
Example config:

```json
    {
        "type": "ml-jsdebugger",
        "request": "attach",
        "name": "Attach to Debug Request",
        "path": "${workspaceFolder}",
        "hostname": "localhost",
        "servername": "8020"
    }
```

In attach mode, servername and path are required parameters. Attach mode connects to a request running on debug server (you need to first connect the server to debugger ). Once you starts debugging,
a dropdown menu will pop up that lists all paused requests under the debug server. Then choose the one of interest for debugging.

## Coming soon

We have not implemented streaming back module files currently, so if you import other modules in your script, you won't be able to inspect, set breakpoints in those files. Unless in attach mode, you have a mirror copy of the modules directory or set path to the module root, you will be able to work on multiple files. This limitation will hopefully be soon addressed.

## Note on how to build the extension

run following command in root module (install vsce)

```
vsce package

```





