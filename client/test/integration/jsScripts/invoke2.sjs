const a = 'a';
const b = 'b';
const c = 'c';
const evalRes = xdmp.invoke('/MarkLogic/test/xqyInvoke-1.xqy', {}, { 'modules': xdmp.database('%%MODULES-DATABASE%%') });

evalRes;