/* eslint-disable @typescript-eslint/no-var-requires */
for (let i = 0; i < 30; i++) {
    const r = 0;
    const m = 1;

    const foo = require('/MarkLogic/test/lib1.sjs');
    const bar = require('/MarkLogic/test/lib2.sjs');
    const res = r + m + foo() + bar();
}


