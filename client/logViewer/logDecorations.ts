import * as vscode from 'vscode'

export function CreateDecorations(): () => void {
    const timeDecorationType = vscode.window.createTextEditorDecorationType({
        light: {
            color: 'lightgrey'
        },
        dark: {
            color: 'darkgrey'
        }
    })

    const hostDecorationTypes = [
        '#d94c4c',
        '#96e68a',
        '#6554bf',
        '#bf6443',
        '#43bfa6',
        '#ae8ae6',
        '#bf9643',
        '#73b0bf',
        '#bf43a6',
        '#e5df8a',
        '#8aa2e6',
        '#cc7a85'
    ].map (color => vscode.window.createTextEditorDecorationType({
        color: color
    }))

    const messageDecorationType = vscode.window.createTextEditorDecorationType({
        light: {
            color: 'darkblue'
        },
        dark: {
            color: 'lightblue'
        }
    })

    return () => {
        const activeEditor = vscode.window.activeTextEditor
        if (!activeEditor) {
            return
        }
        const regex = /^(.*)\|(.*)\|(.*)$/gm
        const text = activeEditor.document.getText()
        const timeText: vscode.DecorationOptions[] = []
        const hostTextMap = new Map<string, vscode.DecorationOptions[]>()
        const messageText: vscode.DecorationOptions[] = []

        let match: RegExpExecArray
        while (match = regex.exec(text)) {
            const timeStart = match.index
            const timeEnd = timeStart + match[1].length
            const hostName = match[2]
            const hostStart = timeEnd + 1
            const hostEnd = hostStart + hostName.length
            const messageStart = hostEnd + 1
            const messageEnd = messageStart + match[3].length

            timeText.push({
                range: new vscode.Range(
                    activeEditor.document.positionAt(timeStart),
                    activeEditor.document.positionAt(timeEnd)
                )
            })
            messageText.push({
                range: new vscode.Range(
                    activeEditor.document.positionAt(messageStart),
                    activeEditor.document.positionAt(messageEnd)
                )
            })

            if (!hostTextMap.has(hostName)) hostTextMap.set(hostName, [])
            hostTextMap.get(hostName).push({
                range: new vscode.Range(
                    activeEditor.document.positionAt(hostStart),
                    activeEditor.document.positionAt(hostEnd)
                )
            })
        }

        activeEditor.setDecorations(timeDecorationType, timeText)
        activeEditor.setDecorations(messageDecorationType, messageText)
        Array.from(hostTextMap.values()).forEach(
            (hostText, i) =>
                activeEditor.setDecorations(hostDecorationTypes[i % hostDecorationTypes.length], hostText)
        )
    }
}
