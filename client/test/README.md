# Testing
Testing JavaScript adapter requires a running MarkLogic server, hence testing will not cover adapter by default. 
To enable, set the flag in `runSJSDebuggerTest` to `true` in [**index.ts**]

Running JavaScript adapter testing requires following setup:

1. Configure mlxpr setting, ensure user has read/write permission as testing needs to upload testdata
2. One `Modules` database is available
3. Create test server on port `8080` with name `JSdebugTestServer` and set modules to your `Modules` database

JavaScript adapter testing will perform following:
- Upload test scripts/modules to `Modules` database
- Run tests against the uploaded scripts
- Delete scripts from `Modules` databse

To ensure isolation, it is advised to create a seperate modules database and set it correspondingly on mlxpr setting