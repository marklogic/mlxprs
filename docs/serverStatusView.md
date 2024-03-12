---
layout: default
title: Server Status View
nav_order: 3
---


### Server Status View

MLXPRS includes an icon ( 
<img src="/assets/Progress_PrimarySymbol.svg" width="15" height="15" style="filter: grayscale(1);"/>
 ) in the VSCode activity bar, which VSCode displays by default on the left side of the
VSCode window. When selected, an explorer view is shown, which can provide information
about the currently configured MarkLogic server. 

The first time the Server Status View is displayed, the MarkLogic server is queried for
a list of configured databases and app servers, as well as a list of app servers that
are currently in "connected" mode - see
[Attach - Attach & step through remote requests](remoteRequests.md) for more
information. Then, the view and lists are updated anytime there is a change to
'marklogic' configuration values. Finally, you can also request a refresh of a specific
list by clicking on the list header (Databases, App-Servers, Debug App Servers).


### Server Databases & App Servers

The top half of the MarkLogic Server Explorer is the MarkLogic Server Configuration.
This section displays a list of databases and app servers configured in the MarkLogic
server.

You can click on any of databases and app servers shown in this section to open the
MarkLogic Admin page for that resource.


### App Server Debug Configuration

The bottom half of the MarkLogic Server Explorer is the MarkLogic App Server Debug
Status. This section displays a list of App Servers that are currently in "connected"
mode.