# Contributing to mlxprs

The MarkLogic extension for Visual Studio Code is an open-source project developed and maintained by the community. You can help by identifying bugs, requesting features you’d like to see, or even submitting code.

_This project and its code and functionality are not representative of MarkLogic Server and are not supported by MarkLogic._

## Found a bug or issue?

If you find a problem, or want to request something that’s lacking, please [file an issue](https://github.com/mikrovvelle/mlxprs/issues/new). Make sure to specify which version of the extension you’re using as well as the version of MarkLogic you’re working against.

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

### Submitting a Pull Request

Please refer to [Github's documentation on the matter](https://help.github.com/articles/creating-a-pull-request/).

#### Formatting code

Project coding standards for formatting and styling are documented in `.editorconfig` and `.eslintrc.json`. Both of these tools offer VS Code extensions to automatically recommend and/or apply rules while editing:

- [editorconfig VS Code extension](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) 
- [eslint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

### Notes on development environment

Please try to develop, build, and test with the most recent stable releases of the following components:

- Visual Studio Code
- node.js, `npm`
- MarkLogic 9 or 10
