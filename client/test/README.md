# Debugger Integration Testing

Testing the JavaScript adapter requires a running MarkLogic server, so testing will not cover adapter by default.
To enable, set the flag in `runSJSDebuggerTest` to `true` in [**suite/index.ts**](suite/index.ts).

## Setup

JavaScript debugger integration testing requires a running server where you have full admin rights.
It is recommended to use a MarkLogic instance where the "Documents" and "Modules" databases are not used for any other application.
Ideally, you should use a dedicated MarkLogic instance for this purpose altogehter (Docker might be a good idea).

On the MarkLogic instance, create an HTTP server in MarkLogic with the following non-default properties:

- server name: JSdebugTestServer
- root: `/`
- port: `8080`
- modules: "Modules"
- database: "Documents"
- error handler: `/MarkLogic/rest-api/error-handler.xqy`
- url rewriter: `/MarkLogic/rest-api/rewriter.xml`
- ssl: off (ssl certificate template: none)


The test script will perform following:

- Upload test scripts and modules to `Modules` database
- Run tests against the uploaded scripts, simulating JS debugger interactions
- Delete scripts from `Modules` databse
