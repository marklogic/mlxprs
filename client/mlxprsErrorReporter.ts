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

import { MlxprsError } from './mlxprsErrorBuilder';

export class MlxprsErrorReporter {
    static mlxprsOutput = window.createOutputChannel('mlxprs');

    static reportError(mlxprsError: MlxprsError) {
        MlxprsErrorReporter.mlxprsOutput.appendLine(`Error Message: ${mlxprsError.reportedMessage}`);
        if (mlxprsError.code) {
            MlxprsErrorReporter.mlxprsOutput.appendLine(`Error Code: ${mlxprsError.code}`);
        }
        MlxprsErrorReporter.mlxprsOutput.appendLine(`Stack: ${mlxprsError.stack}`);
        MlxprsErrorReporter.mlxprsOutput.show();
        window.showErrorMessage(mlxprsError.popupMessage);
    }
}