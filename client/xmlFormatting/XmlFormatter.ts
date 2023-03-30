'use strict';

// Based on pretty-data (https://github.com/vkiryukhin/pretty-data)
export class XmlFormatter {
    constructor(options?: IXmlFormatterOptions) {
        options = options || {};

        if (typeof options.preferSpaces === 'undefined') {
            options.preferSpaces = false;
        }

        if (typeof options.splitNamespaces === 'undefined') {
            options.splitNamespaces = true;
        }

        options.tabSize = options.tabSize || 4;
        options.newLine = options.newLine || '\n';

        this.newLine = options.newLine || '\n';
        this.indentPattern = (options.preferSpaces) ? ' '.repeat(options.tabSize) : '\t';
        this.splitNamespaces = options.splitNamespaces;
    }

    newLine: string;
    indentPattern: string;
    splitNamespaces: boolean;

    format(xml: string): string {
        xml = this.minify(xml, false);
        xml = xml.replace(/</g, '~::~<');

        if (this.splitNamespaces) {
            xml = xml
                .replace(/xmlns\:/g, '~::~xmlns:')
                .replace(/xmlns\=/g, '~::~xmlns=');
        }

        const parts: string[] = xml.split('~::~');

        let inComment = false;
        let level = 0;
        let output = '';

        for (let i = 0; i < parts.length; i++) {
            // <!
            if (parts[i].search(/<!/) > -1) {
                output += this._getIndent(level, parts[i]);
                inComment = true;

                // end <!
                if (parts[i].search(/-->/) > -1 || parts[i].search(/\]>/) > -1 || parts[i].search(/!DOCTYPE/) > -1) {
                    inComment = false;
                }
            } else if (parts[i].search(/-->/) > -1 || parts[i].search(/\]>/) > -1) {
                // end <!
                output += parts[i];
                inComment = false;
            } else if (/^<\w/.test(parts[i - 1]) && /^<\/\w/.test(parts[i]) && /^<[\w:\-\.\,]+/.exec(parts[i - 1])[0] == /^<\/[\w:\-\.\,]+/.exec(parts[i])[0].replace('/', '')) {
                // <elm></elm>
                output += parts[i];
                if (!inComment) level--;
            } else if (parts[i].search(/<\w/) > -1 && parts[i].search(/<\//) == -1 && parts[i].search(/\/>/) == -1) {
                // <elm>
                output = (!inComment) ? output += this._getIndent(level++, parts[i]) : output += parts[i];
            } else if (parts[i].search(/<\w/) > -1 && parts[i].search(/<\//) > -1) {
                // <elm>...</elm>
                output = (!inComment) ? output += this._getIndent(level, parts[i]) : output += parts[i];
            } else if (parts[i].search(/<\//) > -1) {
                // </elm>
                output = (!inComment) ? output += this._getIndent(--level, parts[i]) : output += parts[i];
            } else if (parts[i].search(/\/>/) > -1 && (!this.splitNamespaces || parts[i].search(/xmlns\:/) == -1)) {
                // <elm />
                output = (!inComment) ? output += this._getIndent(level, parts[i]) : output += parts[i];
            } else if (parts[i].search(/\/>/) > -1 && parts[i].search(/xmlns\:/) > -1 && this.splitNamespaces) {
                // xmlns />
                output = (!inComment) ? output += this._getIndent(level--, parts[i]) : output += parts[i];
            } else if (parts[i].search(/<\?/) > -1) {
                // <?xml ... ?>
                output += this._getIndent(level, parts[i]);
            } else if (parts[i].search(/xmlns\:/) > -1 || parts[i].search(/xmlns\=/) > -1) {
                // xmlns
                output += this._getIndent(level, parts[i]);
            } else {
                output += parts[i];
            }
        }

        // remove leading newline
        if (output[0] == this.newLine) {
            output = output.slice(1);
        } else if (output.substring(0, 1) == this.newLine) {
            output = output.slice(2);
        }

        return output;
    }

    minify(xml: string, removeComments?: boolean): string {
        if (typeof removeComments === 'undefined') {
            removeComments = false;
        }

        xml = this._stripLineBreaks(xml); // all line breaks outside of CDATA elements
        xml = (removeComments) ? xml.replace(/\<![ \r\n\t]*(--([^\-]|[\r\n]|-[^\-])*--[ \r\n\t]*)\>/g, '') : xml;
        xml = xml.replace(/>\s{0,}</g, '><'); // insignificant whitespace between tags
        xml = xml.replace(/"\s+(?=[^\s]+=)/g, '" '); // spaces between attributes
        xml = xml.replace(/"\s+(?=>)/g, '"'); // spaces between the last attribute and tag close (>)
        xml = xml.replace(/"\s+(?=\/>)/g, '" '); // spaces between the last attribute and tag close (/>)
        xml = xml.replace(/[^ <>="]\s+[^ <>="]+=/g, (match: string) => { // spaces between the node name and the first attribute
            return match.replace(/\s+/g, ' ');
        });

        return xml;
    }

    private _getIndent(level: number, trailingValue?: string): string {
        trailingValue = trailingValue || '';

        return `${this.newLine}${this.indentPattern.repeat(level)}${trailingValue}`;
    }

    private _stripLineBreaks(xml: string): string {
        let output = '';
        const inTag = false;
        const inTagName = false;
        let inCdata = false;
        const inAttribute = false;

        for (let i = 0; i < xml.length; i++) {
            const char: string = xml.charAt(i);

            if (char == '!' && (xml.substr(i, 8) == '![CDATA[' || xml.substr(i, 3) == '!--')) {
                inCdata = true;
            } else if (char == ']' && (xml.substr(i, 3) == ']]>')) {
                inCdata = false;
            } else if (char == '-' && (xml.substr(i, 3) == '-->')) {
                inCdata = false;
            } else if (char.search(/[\r\n]/g) > -1 && !inCdata) {
                continue;
            }

            output += char;
        }

        return output;
    }
}

export interface IXmlFormatterOptions {
    preferSpaces?: boolean;
    tabSize?: number;
    newLine?: string;
    splitNamespaces?: boolean;
}