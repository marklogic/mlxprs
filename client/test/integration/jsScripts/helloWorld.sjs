/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
const str = 'Hello World SJS';
const str2 = 'line 2';
const str3 = 'line 3';
const num = loop();
const str4 = 'line 4';
const str5 = 'line 5';


function loop() {
    let ret = 0;
    for (let i = 0; i < 30; i++) {
        ret += i;
    }
    return ret;
}