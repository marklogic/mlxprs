# Contributing to mlxprs

The MarkLogic extension for Visual Studio Code is an open-source project developed and maintained by the community. You can help by identifying bugs, requesting features you’d like to see, or even submitting code.

_This project and its code and functionality are not representative of MarkLogic Server and are not supported by MarkLogic._

## Found a bug or issue?

If you find a problem, or want to request something that’s lacking, please [file an issue](https://github.com/marklogic-community/mlxprs/issues/new). Make sure to specify which version of the extension you’re using as well as the version of MarkLogic you’re working against.

Even better, you can submit a Pull Request with a fix for the issue you filed.

If you would like to implement a new feature, please create a new issue with your proposal.

## Submitting an Issue

Please check the issue tracker before you submit an issue search, to help avoid duplicates. If your issue appears to be a bug, and hasn't been reported, open a new issue. 

The following information is most helpful:

* **Overview of the Issue** — Be clear. What should happen? What does happen?
* **Steps to reproduce** — What exactly do I need to do to experience the issue?
* **Use Case** — If it's not obvious, explain why this is a bug for you
* **Environment** — Mac, windows, MarkLogic version, VS Code version?
* **Pointers** — If you have a hunch or just don't want to bother with a pull request,
please point me in the right direction (e.g. line numbers) to fix it.

# Development

## Project Layout

* **package.json** — Metadata about the project, including details for the extensions browser, dependencies, build scripts, commands and user configuration
* **client** — Main extension folder
    * **extension.ts** — Code insertion point.  Contains initialization code and defines commands callable by user.
    * **marklogicClient.ts** — Interface to MarkLogic [Node Client API](https://github.com/marklogic/node-client-api) package, which is used to communicate with ML Server.
    * **marklogic-types.d.ts** — TypeScript type declarations used by the package.
* **server** — Language server extension folder (provides syntax highlighting; based on vscode-languageserver extension)
    * **package.json** — As the language server is technically a separate package, this defines the dependencies for it
    * **server.ts** — Code insertion point.  Contains initialization code for language server.

* Another important file is .vscode/settings.json. It is recommended that you use settings.json.template to create settings.json, and then customize settings.json to your local environment. Alternatively, these values can also be changed within VSCode when you change settings for this specific workspace.

## Building The Project

Building the project requires [Node.js](https://nodejs.org/) to be installed on your local machine.  Node v14 LTS is recommended.

First, dev dependencies must be installed.  Run `npm install` in both this folder, and in the `./server` folder.  For example:

```
npm install
cd server
npm install
cd ..
```
A shorthand script that does all of that for you is
```
npm run npmInstallClientAndServer
```

It is recommended to use VSCode as the editor for this package, as it can self-load a debug instance.

* Open the project folder in VSCode
* Select the "Run and Debug" sidebar window (Ctrl+Shift+D)
* Choose "Launch Extension (debug)" from the RUN AND DEBUG dropdown menu
* Press the green play button or F5 to compile and launch the plugin in a test environment
    * Note that at this time, the "Attach" commands do not work when debugging the extension from within VSCode. In order to test the "Attach" commands, you will need to build the artifact (.vsix) and use that extension with a different project, and then test manually.
* Please see the README.md file for information on configuring and working in the test environment

## Testing

The project contains three test applications.

* Client Tests - Runs the test files under /client/test/suite, transpiled to /dist/test/suite
    * client.test.js 
    * xqyRuntime.test.js 
* Server Tests - Runs the test files under /server/test/suite, transpiled to /server/dist/test/suite
    * server.test.js
* Client-Integration Tests - Runs the test files under /client/test/integration, transpiled to /dist/test/integration
    * Requires ML App Server setup first (See "Integration Testing Setup" below for more information)
    * sjsAdapter.test.js 


### Integration Testing Setup

JavaScript debugger integration testing requires a running MarkLogic server where you have full admin rights. Ideally, you should use a dedicated MarkLogic instance for this purpose. The tests assume the existence of a "mlxprs-test" application server running on port 8055 using the "mlxprs-test-content" and "mlxprs-test-modules" databases. Those values are set in gradle.properties and the admin password should be set in gradle-local.properties. Then you can use the command, "./gradlew -i mlDeploy" to build and configure the databases and application servers.

### Integration Test Overview
The integration test will do the following:
* Upload test scripts and modules to `Modules` database
* Run tests against the uploaded scripts and MarkLogic application server, simulating JS debugger interactions
* Delete scripts from `Modules` databse
* Results are currently written to "results/integrationTestResults.xml".

### Testing from within VSCode
Within VSCode, unit tests are available from the dropdown menu in the Run and Debug panel.  There are currently three run configurations for three test sets in launch.json

* "Launch Client Tests"
* "Launch Server Tests"
* "Launch Client-Integration Tests"


For the Client-Integration test, the code (test code only) defaults to the same settings as the default values in the gradle.properties file. If you need to override the default properties, you have 3 options.
1. Edit the values the integration.env file (in ${workspaceFolder}/client/test/integration), and add the following property to the launch configuration for Client-Integration:
```
"envFile": "${workspaceFolder}/client/test/integration/integration.env"`
```
2. Export environment variables with the same names as the examples in integration.env. For example in a bash shell:
```
export ML_PASSWORD=admin
```
3. If you are running the tests from within VSCode, you can package and load the MarkLogic extension, and set the values on the extension settings page. If you need to build the artifact so that you can load the version of the extension you are working on, please see the "Building the artifact" section below.

Note that the order of priority for setting the property values in the test code is the following
1. Environment variables
2. Extension settings
3. Default values (hard-coded, but matches gradle.properties)


### Testing from the command line
Run these two npm scripts from the command line in the root directory of the project to execute the tests. Note that VSCode must not be running while you run the tests.
```
npm run npmInstallClientAndServer
npm run test
npm run testServer
code --extensionDevelopmentPath=<mlxprs-project-dir>/client --extensionTestsPath=<mlxprs-project-dir>/dist/test/integration/index
```
<mark>The final test (the integration tests), should not be run while VSCode is open.</mark>

To ensure a clean build, you may also run this npm script before running the npmInstallClientAndServer script.
```
npm run completeClean
```

## Building the artifact

- Install the webpack tool
```
npm install -g webpack
```
- Install the vsce tool
```
npm install -g @vscode/vsce
```
- Build the artifact
```
vsce package
```
- If you are running in a Windows environment, you will need to use npx:
```
npx vsce package
```
This should produce a file with the name, "mlxprs-<version>.vsix"

### Windows environment - IMPORTANT NOTE
The same NPM scripts should work in Windows, however this is not thoroughly verified. In order to run all the scripts from package.json in a Windows environment, it is recommended that you install the 'rimraf', 'typescript', and 'webpack' node packages globally.
```
npm install -g rimraf
npm install -g typescript
```

## Submitting a Pull Request

Please refer to [Github's documentation on the matter](https://help.github.com/articles/creating-a-pull-request/).

## Formatting code

Project coding standards for formatting and styling are documented in `.editorconfig` and `.eslintrc.json`. Both of these tools offer VS Code extensions to automatically recommend and/or apply rules while editing:

- [editorconfig VS Code extension](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) 
- [eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Notes on development environment

Please try to develop, build, and test with the most recent stable releases of the following components:

- Visual Studio Code
- node.js, npm (v14 LTS)
- MarkLogic 9, 10, or 11

## Publishing the artifact
See [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) for more information