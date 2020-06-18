const a = 'a'
const b = 'b'
const c = 'c'
const evalRes = xdmp.invoke('/MarkLogic/test/jsInvoke-1.sjs', {}, {'modules': xdmp.database('Modules')})

evalRes