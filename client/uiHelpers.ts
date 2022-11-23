import * as vscode from 'vscode'

export class BooleanPickItem implements vscode.QuickPickItem {
    alwaysShow = true;
    label: string;
    value: boolean;
    picked: boolean;

    constructor(value: boolean, picked: boolean) {
        this.label = value.toString()
        this.value = value
        this.picked = picked
    }
}

export function getBooleanPickItems(picked: boolean): BooleanPickItem[] {
    return [
        new BooleanPickItem(true, picked),
        new BooleanPickItem(false, !picked)
    ]
}

export class PickItem<T> implements vscode.QuickPickItem {
    alwaysShow = true;
    label: string;
    value: T;
    picked: boolean;

    constructor(value: T, label: string, picked: boolean) {
        this.label = label
        this.value = value
        this.picked = picked
    }
}

export function getSelectedPickItems<T>(items: T[], labels: string[] = []): PickItem<T>[] {
    return items.map((item, index) => new PickItem<T>(
        item, labels[index] || item.toString(), true
    ))
}

export function getPickItems<T>(items: T[], labels: string[] = []): PickItem<T>[] {
    return items.map((item, index) => new PickItem<T>(
        item, labels[index] || item.toString(), false
    ))
}

//Returns number of seconds in a string of format `#d #h #m #s`
export function parseTimeString(s: string): number {
    if (!s) {
        return 0
    }
    const regex = /(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/i
    const match = s.replace(/\s+/g, '').match(regex)
    return 0 +
        (parseInt(match[1]) || 0) * 86400 +
        (parseInt(match[2]) || 0) * 3600 +
        (parseInt(match[3]) || 0) * 60 +
        (parseInt(match[4]) || 0)
}
