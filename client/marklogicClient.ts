'use strict';

import * as ml from 'marklogic';
import * as fs from 'fs';
import { ExtensionContext, WorkspaceConfiguration } from 'vscode';

const MLDBCLIENT = 'mldbClient';

class MarklogicVSClient {
  contentDb: string;
  modulesDb: string;

  host: string;
  port: number;
  user: string;
  pwd: string;
  authType: string;
  ssl: boolean;
  pathToCa: string;
  ca: string;

  docsDbNumber: string;
  mldbClient: ml.DatabaseClient;
  constructor(host: string, port: number,
    user: string, pwd: string, authType: string,
    contentDb: string, modulesDb: string,
    ssl: boolean, pathToCa: string) {
    this.contentDb = contentDb;
    this.modulesDb = modulesDb;
    this.host = host;
    this.port = port;
    this.user = user;
    this.pwd = pwd;
    this.authType = authType.toUpperCase();
    this.ssl = ssl;
    this.pathToCa = pathToCa;

    this.docsDbNumber = "0";
    if (pathToCa !== '') {
      try {
        this.ca = fs.readFileSync(this.pathToCa, 'utf8')
      } catch (e) {
        throw new Error("Error reading CA file: " + e.message);
      }
    }
    if (authType !== 'DIGEST' && authType !== 'BASIC') {
      this.authType = 'DIGEST'
    }
    this.mldbClient = ml.createDatabaseClient({
      host: host, port: port, user: user, password: pwd,
      authType: authType, ssl: ssl, ca: this.ca
    });
    this.mldbClient.eval("xdmp.database('" + contentDb + "')")
      .result(null, null).then((response) => {
        this.docsDbNumber = response[0]['value'];
      });
  };

  toString(): string {
    return [this.host, this.port, this.user,
    this.pwd, this.authType,
    this.contentDb, this.modulesDb,
    this.ssl, this.pathToCa].join(":");
  }

  compareTo(host: string, port: number, user: string,
    pwd: string, authType: string,
    contentDb: string, modulesDb: string,
    ssl: boolean, pathToCa: string): boolean {
    let newParams =
      [host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa].join(":");
    return (this.toString() === newParams);
  }
}

function buildNewClient(host: string, port: number, user: string,
  pwd: string, authType: string, contentDb: string,
  modulesDb: string, ssl: boolean, pathToCa: string): MarklogicVSClient {
  let newClient: MarklogicVSClient;
  try {
    newClient = new MarklogicVSClient(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)
  } catch (e) {
    console.error("Error: " + JSON.stringify(e));
    throw(e)
  }
  return newClient;
};

/**
 * Caching mechanism for the ML Client in the VSCode global state.
 */
export function getDbClient(cfg: WorkspaceConfiguration, cntxt: ExtensionContext): MarklogicVSClient {
  let host = String(cfg.get("marklogic.host"));
  let user = String(cfg.get("marklogic.username"));
  let pwd = String(cfg.get("marklogic.password"));
  let port = Number(cfg.get("marklogic.port"));
  let contentDb = String(cfg.get("marklogic.documentsDb"));
  let modulesDb = String(cfg.get("marklogic.modulesDb"));
  let authType = String(cfg.get("marklogic.authType")).toUpperCase();
  let ssl = Boolean(cfg.get("marklogic.ssl"));
  let pathToCa = String(cfg.get("marklogic.pathToCa"));

  // if settings have changed, release and clear the client
  let mlc = <MarklogicVSClient>cntxt.globalState.get(MLDBCLIENT);
  if (mlc !== null && !mlc.compareTo(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)) {
    mlc.mldbClient.release();
    cntxt.globalState.update(MLDBCLIENT, null);
    console.info("Cleared MarkLogicVSClient for new settings.");
  }

  // if there's no existing client in the globalState, instantiate a new one
  if (cntxt.globalState.get(MLDBCLIENT) === null) {
    let newClient: MarklogicVSClient =
      buildNewClient(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa);
    try {
      cntxt.globalState.update(MLDBCLIENT, newClient);
      console.info("New MarkLogicVSClient: " + cntxt.globalState.get(MLDBCLIENT));
    } catch (e) {
      console.error("Error: " + JSON.stringify(e));
      e.message ? console.error(e.message) : null;
    }
  };
  return cntxt.globalState.get<MarklogicVSClient>(MLDBCLIENT);
};