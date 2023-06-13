## [3.6.2](https://github.com/marklogic-community/mlxprs/releases/tag/v3.6.2)

- Fixed the icon used in the Visual Studio Marketplace 

## [3.7.0](https://github.com/marklogic-community/mlxprs/releases/tag/v3.7.0)

- [#DEV-261](https://project.marklogic.com/jira/browse/DEVEXP-261) Submit an Optic DSL Query to /v1/rows and get back JSON
- [#DEV-262](https://project.marklogic.com/jira/browse/DEVEXP-262) Submit Optic Query and get back XML or CSV
- [#DEV-353](https://project.marklogic.com/jira/browse/DEVEXP-353) View "Connected" status information in bottom status line
- [#DEV-350](https://project.marklogic.com/jira/browse/DEVEXP-350) Made the UX for attaching to a JS server match attaching to an XQY server, and sorted based on server name
- [#DEV-349](https://project.marklogic.com/jira/browse/DEVEXP-349) Run Highlighted Code in editor windows (rather than the entire window)
- [#DEV-352](https://project.marklogic.com/jira/browse/DEVEXP-352) Display "eval" results in a new tab in the bottom panel (use a setting to revert back to an editor tab)
- [#DEV-364](https://project.marklogic.com/jira/browse/DEVEXP-364) Permit attaching to a remote request even if the current editor tab is not source code


## [3.6.0](https://github.com/marklogic-community/mlxprs/releases/tag/v3.6.0)

- [#116](https://github.com/marklogic-community/mlxprs/issues/116) Updated dependencies and fixed all known security vulnerabilities
- [#119](https://github.com/marklogic-community/mlxprs/issues/119) Added SJS binding to JavaScript language
- [#97](https://github.com/marklogic-community/mlxprs/issues/97) Added a configuration option for the MarkLogic Manage app server port (used for the SJS debug server port)
- [#117](https://github.com/marklogic-community/mlxprs/issues/117) Fixed a bug with the first attempt to eval a JavaScript tab
- [#109](https://github.com/marklogic-community/mlxprs/issues/109) Prevent the database param from being used in REST calls when the database setting is empty


## [3.5.1](https://github.com/mikrovvelle/mlxprs/tree/v3.5.1)

- Fix [#92](https://github.com/mikrovvelle/mlxprs/issues/92), better error handling with XQuery debug launch failures
- Added VS Code badges to Readme

## [3.5.0](https://github.com/mikrovvelle/mlxprs/tree/v3.5.0)

- #91: Added "Eval SQL" Command.

## [3.4.0](https://github.com/mikrovvelle/mlxprs/tree/v3.4.0)

- #91: Added "Eval SPARQL" Command.

## [3.3.0](https://github.com/mikrovvelle/mlxprs/tree/v3.3.0)

Addressed off-by-one error in changelog.

## [3.2.0](https://github.com/mikrovvelle/mlxprs/tree/v3.2.0)

- new feature #85: allow ignoring insecure SSL connection.

  You can disable client certificate checking by setting `marklogic.rejectUnauthorized` to `false` in your VS Code configuration (defaut is `true`).

## [3.1.0](https://github.com/mikrovvelle/mlxprs/tree/v3.1.0)

- fixes: #70. SJS debugging now streams modules if they're not available locally
- other SJS debugging improvements

## [3.0.4](https://github.com/mikrovvelle/mlxprs/tree/v3.0.4)

- bugfix: #69

## [3.0.3](https://github.com/mikrovvelle/mlxprs/tree/v3.0.3)

- add "MarkLogic: Show module" command
- fixes: #68. XQuery debugging now streams modules if they're not available locally

## [3.0.2](https://github.com/mikrovvelle/mlxprs/tree/v3.0.2)

- bugfix: #67

## [3.0.1](https://github.com/mikrovvelle/mlxprs/tree/v3.0.1)

- fix: #10 - make best effort to format XML and JSON query results

## [3.0.0](https://github.com/mikrovvelle/mlxprs/tree/v3.0.0)

- add XQuery debugging

## [2.0.0](https://github.com/mikrovvelle/mlxprs/tree/v2.0.0)

- add JavaScript debugging

## [1.2.2](https://github.com/mikrovvelle/mlxprs/tree/v1.2.2)

- dependency upgrades under the hood

## [1.2.1](https://github.com/mikrovvelle/mlxprs/tree/v1.2.1)

- fix: #17
- bugfix: empty results aren't 'pending'

## [1.2.0](https://github.com/mikrovvelle/mlxprs/tree/v1.2.0)

- Added per-query client parameter override capability to XQuery (see README)

## [1.1.1](https://github.com/mikrovvelle/mlxprs/tree/v1.1.1)

- Security fixes for npm dependencies

## [1.1.0](https://github.com/mikrovvelle/mlxprs/tree/v1.1.0)

- Added per-query client parameter override capability SJS (see README)

## [1.0.0](https://github.com/mikrovvelle/mlxprs/tree/v1.0.0)

- Working release

## [0.7.7](https://github.com/mikrovvelle/mlxprs/tree/v0.7.5)

- Security fixes for npm dependencies

## [0.7.5](https://github.com/mikrovvelle/mlxprs/tree/v0.7.5)

- Cosmetic: branding in preparation for 1.0 release

## [0.7.2](https://github.com/mikrovvelle/mlxprs/tree/v0.7.2)

- Security: update `js-yaml` dependency to fix vulnerability

## [0.7.1](https://github.com/mikrovvelle/mlxprs/tree/v0.7.1)

- Bugfix: Javascript language mode wasn't activating the extension.

## [0.7.0](https://github.com/mikrovvelle/mlxprs/tree/v0.7.0)

- Added SJS autocompletion based on MarkLogic SJS API

## [0.6.2](https://github.com/mikrovvelle/mlxprs/tree/v0.6.2)

- Successfully built with webpack

## 0.6.0 to 0.6.1 (broken)

- Built with webpack

## [0.5.0](https://github.com/mikrovvelle/mlxprs/tree/0.5.0)

- Added SSL capabilities to MarkLogic client: `ssl` and `pathToCa` settings
- Exposed `authType` to marklogic settings (can pretty much leave set to DIGEST)

## [0.4.0](https://github.com/mikrovvelle/mlxprs/tree/0.4.0)

- Added code completion for MarkLogic XQuery API functions

## [0.3.3](https://github.com/mikrovvelle/mlxprs/tree/0.3.3)

- Bugfix: properly handle and display text responses to MarkLogic queries

## [0.3.2](https://github.com/mikrovvelle/mlxprs/tree/0.3.2)

- License and copyright

## [0.3.1](https://github.com/mikrovvelle/mlxprs/tree/0.3.1)

- Handle and display text responses to MarkLogic queries

## [0.3.0](https://github.com/mikrovvelle/mlxprs/tree/0.3.0)

- Show error details as query results

## [0.2.0](https://github.com/mikrovvelle/mlxprs/tree/0.2.0)

- Give user feedback when empty results are returned from a query

## [0.1.0](https://github.com/mikrovvelle/mlxprs/tree/0.1.0)

- Added XML formatting
