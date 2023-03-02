# Contributing to mlxprs

The MarkLogic extension for Visual Studio Code is an open-source project developed and maintained by the community. You can help by identifying bugs, requesting features you’d like to see, or even submitting code.

_This project and its code and functionality are not representative of MarkLogic Server and are not supported by MarkLogic._

## Found a bug or issue?

If you find a problem, or want to request something that’s lacking, please [file an issue](https://github.com/marklogic-community/mlxprs/issues/new). Make sure to specify which version of the extension you’re using as well as the version of MarkLogic you’re working against.

Even better, you can submit a Pull Request with a fix for the issue you filed.

If you would like to implement a new feature, please create a new issue with your proposal.

### Submitting an Issue

Please check the issue tracker before you submit an issue search, to help avoid duplicates. If your issue appears to be a bug, and hasn't been reported, open a new issue. 

The following information is most helpful:

* **Overview of the Issue** — Be clear. What should happen? What does happen?
* **Steps to reproduce** — What exactly do I need to do to experience the issue?
* **Use Case** — If it's not obvious, explain why this is a bug for you
* **Environment** — Mac, windows, MarkLogic version, VS Code version?
* **Pointers** — If you have a hunch or just don't want to bother with a pull request,
please point me in the right direction (e.g. line numbers) to fix it.

## Development, Builds and Testing

### Project Layout

* **package.json** — Metadata about the project, including details for the extensions browser, dependencies, build scripts, commands and user configuration
* **client** — Main extension folder
    * **extension.ts** — Code insertion point.  Contains initialization code and defines commands callable by user.
    * **marklogicClient.ts** — Interface to MarkLogic [Node Client API](https://github.com/marklogic/node-client-api) package, which is used to communicate with ML Server.
    * **marklogic-types.d.ts** — TypeScript type declarations used by the package.
* **server** — Language server extension folder (provides syntax highlighting; based on vscode-languageserver extension)
    * **package.json** — As the language server is technically a separate package, this defines the dependencies for it
    * **server.ts** — Code insertion point.  Contains initialization code for language server.

### Building and Testing Project

Building the project requires [Node.js](https://nodejs.org/) to be installed on your local machine.  Node v14 LTS is recommended.

First, dev dependencies must be installed.  Run `npm install` in both this folder, and in the `./server` folder.  For example:

```
npm install
cd server
npm install
cd ..
```

***IMPORTANT NOTE:***
*The shell scripts used to drive node compilation assume a \*nix environment.  If you are on Windows, you have a few options:*
* Install WSL
* Install GitBash
* Install PowerShell v7+
    * Windows Powershell v5.1 is not supported
    * [Migration Instructions](https://learn.microsoft.com/en-us/powershell/scripting/whats-new/migrating-from-windows-powershell-51-to-powershell-7?view=powershell-7.2)
    * Note: this is currently broken because of [an open bug in npm](https://github.com/npm/cli/issues/5332).  Use Bash.  :(
        
You can choose which environment should be used as the default shell for npm with the command `npm config set script-shell [shell]`.  For instance, to use WSL Bash, you would run `npm config set script-shell bash`.  PowerShell v7+ is `npm config set script-shell pwsh`  You can reset this with `npm config delete script-shell`.  Even if running npm from PowerShell, it will try to use cmd.exe as the default shell if you do not define it.

To compile changes, run `npm run-script compile`.  Note that both the client and the language server need to finish compiling before you attempt to run the extension, or you will get an error.  Other script definitions are in `package.json.`

It is recommended to use VSCode as the editor for this package, as it can self-load a debug instance.

* Open the project folder in VSCode
* Select the "Run and Debug" sidebar window (Ctrl+Shift+D)
* Choose "Launch Extension (debug)" from the RUN AND DEBUG dropdown menu
* Press the green play button or F5 to compile and launch the plugin in a test environment
* Please see the README.md file for information on configuring and working in the test environment

#### Testing from within VSCode
Unit tests are available from the dropdown menu, as well.  These are very basic at the moment, and need some love.
There are currently three run configurations for tests in launch.json

* "Launch Client Tests"
    * Runs the tests under /dist/test/suite
    * Transpiled from files under /client/test/suite
        * client.test.js 
        * xqyRuntime.test.js 
* "Launch Server Tests"
    * Runs the tests under /server/dist/test/suite
    * Transpiled from files under /server/test/suite
        * server.test.js
* "Launch Client-Integration Tests"
    * Requires ML App Server setup first (See "Debugger Integration Testing" below for more information)
    * Runs the tests under /dist/test/integration
    * Transpiled from files under /client/test/integration
        * sjsAdapter.test.js 


## Setup

JavaScript debugger integration testing requires a running server where you have full admin rights.
It is recommended to use a MarkLogic instance where the "Documents" and "Modules" databases are not used for any other application.
Ideally, you should use a dedicated MarkLogic instance for this purpose altogehter (Docker might be a good idea).

On the MarkLogic instance, create an HTTP server in MarkLogic with the following non-default properties:

- server name: JSdebugTestServer
- root: `/`
- port: `8055`
- modules: "Modules"
- database: "Documents"
- error handler: `/MarkLogic/rest-api/error-handler.xqy`
- url rewriter: `/MarkLogic/rest-api/rewriter.xml`
- ssl: off (ssl certificate template: none)


The test script will perform following:

- Upload test scripts and modules to `Modules` database
- Run tests against the uploaded scripts, simulating JS debugger interactions
- Delete scripts from `Modules` databse


#### Testing from the command line

* npm test - runs the client tests (not including the integration tests)
* npm run testServer - runs the server tests
* There's nothing in place yet for running the integration tests from the command line


### Submitting a Pull Request

Please refer to [Github's documentation on the matter](https://help.github.com/articles/creating-a-pull-request/).

#### Formatting code

Project coding standards for formatting and styling are documented in `.editorconfig` and `.eslintrc.json`. Both of these tools offer VS Code extensions to automatically recommend and/or apply rules while editing:

- [editorconfig VS Code extension](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) 
- [eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

### Notes on development environment

Please try to develop, build, and test with the most recent stable releases of the following components:

- Visual Studio Code
- node.js, npm (v14 LTS)
- MarkLogic 9 or 10
