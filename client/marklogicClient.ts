'use strict';

import * as ml from 'marklogic';
import * as fs from 'fs';

export default class MarklogicVSClient {
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

