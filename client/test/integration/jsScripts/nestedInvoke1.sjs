const a = 'a'
const b = 'b'
const c = 'c'
const evalRes = xdmp.invoke('/MarkLogic/test/jsInvoke-2.sjs', {}, { 'modules': xdmp.database('%%MODULES-DATABASE%%') })


evalRes
