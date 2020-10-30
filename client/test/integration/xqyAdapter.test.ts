import { window, workspace, WorkspaceConfiguration } from 'vscode'
import { after, before } from 'mocha'
import * as Path from 'path'
import { buildNewClient, MarklogicClient, MlClientParameters } from '../../marklogicClient'
import { DebugClient } from 'vscode-debugadapter-testsupport'
import { readFileSync } from 'fs'
import { XqyDebugConfiguration } from '../../XQDebugger/xqyDebugConfigProvider'
import { ModuleContentHandler } from '../../moduleContentHandler'

const XQUERYML = 'xquery-ml'
const XQNAME = 'Launch XQY Debug Request'
const LAUNCH = 'launch'
const COLLECTION = 'VSCODE/XQY-debug-test'

suite('XQuery Debug Test Suite', () => {
    const cfg: WorkspaceConfiguration = workspace.getConfiguration()
    const clientParams: MlClientParameters = new MlClientParameters({
        host: String(cfg.get('marklogic.host')),
        port: Number(cfg.get('marklogic.port')),
        user: String(cfg.get('marklogic.username')),
        pwd: String(cfg.get('marklogic.password')),
        contentDb: String(cfg.get('marklogic.documentsDb')),
        modulesDb: String(cfg.get('marklogic.modulesDb')),
        authType: String(cfg.get('marklogic.authType')),
        ssl: Boolean(cfg.get('marklogic.ssl')),
        pathToCa: String(cfg.get('marklogic.pathToCa') || ''),
        rejectUnauthorized: Boolean(cfg.get('marklogic.rejectUnauthorized'))
    })
    const mlClient: MarklogicClient = buildNewClient(clientParams)
    const modHandler: ModuleContentHandler = new ModuleContentHandler(mlClient)

    let dc: DebugClient
    const rootFolder = Path.join(__dirname, '../../..')
    const exec = Path.join(rootFolder, 'dist/XQDebugger/xqyDebug.js')
    const scriptFolder = Path.join(rootFolder, 'client/test/xqScripts')

    setup(() => {
        dc = new DebugClient('node', exec, 'node')
        return dc.start(4712)
    })

    teardown(() => {
        dc.stop()
    })

    const hwPath = Path.join(scriptFolder, 'helloWorld.xqy')
    const hwScript = readFileSync(hwPath).toString()

    const hwConfig: XqyDebugConfiguration = {
        program: hwPath,
        root: rootFolder,
        query: hwScript,
        stopOnEntry: true,
        type: XQUERYML,
        name: XQNAME,
        request: LAUNCH,
        rid: '',

        clientParams: clientParams
    }


    // before(async () => {
    // modHandler.writeTextDocumentContent(`/MarkLogic/test/${Path.basename(hwPath)}`, hwScript, COLLECTION)
    //     .then(fulfill => console.debug(`inserted module at ${hwPath}: ${JSON.stringify(fulfill)}`))
    //     .catch(err => console.error(`Error uploading ${hwPath}: ${JSON.stringify(err)}`))
    //     .finally(() => window.showInformationMessage('XQY debugger tests starting...'))

    // })

    suite('Basic', () => {
        test('launch a script and it shuold stop at entry', async () => {
            return Promise.all([
                dc.configurationSequence(),
                dc.launch(hwConfig),
                dc.assertStoppedLocation('entry', {})
            ])
        })
    })
})
