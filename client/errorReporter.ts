/*
 * Copyright (c) 2023 MarkLogic Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { window } from 'vscode';

export interface MlxprsError {
    popupMessage: string;
    reportedMessage: string;
    stack: string;
    code?: string
}

export class ErrorReporter {
    static mlxprsOutput = window.createOutputChannel('mlxprs');

    static buildMlxprsErrorFromError(error: Error, popupMessageBase: string): MlxprsError {
        const mlxprsError: MlxprsError = {
            reportedMessage: 'Unable to determine the error message',
            stack: 'Unable to find the stack trace in the error object',
            popupMessage: `${popupMessageBase}`
        };
        if (error['reason']) {
            mlxprsError.popupMessage = `${popupMessageBase}:${error['reason']}`;
        }
        if (error.message) {
            mlxprsError.reportedMessage = error.message;
            mlxprsError.popupMessage = `${popupMessageBase}:${error.message}`;
        }
        if (error.stack) {
            mlxprsError.stack = error.stack;
        }
        if (error['code']) {
            mlxprsError.code = error['code'];
        }
        if (error['statusCode']) {
            mlxprsError.code = error['statusCode'];
        }
        if (error['body']) {
            if (error['body']['errorResponse']) {
                mlxprsError.reportedMessage = error['body']['errorResponse']['message'];
                mlxprsError.code = error['body']['errorResponse']['messageCode'];
                mlxprsError.popupMessage = `${popupMessageBase}:${error['body']['errorResponse']['status']}`;
            }
        }
        return mlxprsError;
    }

    static reportError(mlxprsError: MlxprsError) {
        ErrorReporter.mlxprsOutput.appendLine(`Error Message: ${mlxprsError.reportedMessage}`);
        if (mlxprsError.code) {
            ErrorReporter.mlxprsOutput.appendLine(`Error Code: ${mlxprsError.code}`);
        }
        ErrorReporter.mlxprsOutput.appendLine(`Stack: ${mlxprsError.stack}`);
        ErrorReporter.mlxprsOutput.show();
        window.showErrorMessage(mlxprsError.popupMessage);
    }
}