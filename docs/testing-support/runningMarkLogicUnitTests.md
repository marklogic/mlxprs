---
layout: default
title: Running marklogic-unit-test modules
nav_order: 1
parent: Testing Support
---

### Run marklogic-unit-test module

This plugin provides a convenient method for running a [marklogic-unit-test module](https://marklogic-community.github.io/marklogic-unit-test/) within your MarkLogic server. To get started, your test suites and files must be organized under a "src/test/ml-modules/root/test/suites" directory. See this [ml-gradle sample project](https://github.com/marklogic/ml-gradle/tree/master/examples/unit-test-project) for an example of how to setup the project to use marklogic-unit-test. Additionally, you need to set the `Marklogic: Test Port` setting to the port number of the App Server that can run your unit tests. Finally, to run a test file:

1. In an editor tab, open the test file that you wish to be executed.
2. Open the VS Code command palette.
3. Select `MarkLogic: Run marklogic-unit-test Module` from the list.

The results of the tests will appear in the `MLXPRS: RESULTS` tab in the bottom panel.


