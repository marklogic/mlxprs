const a = 'a'
const b = 'b'
const c = 'c'
const evalRes = xdmp.xqueryEval(
    'xquery version "1.0-ml";\n\
         for $i in (1 to 10)\n\
         return $i * 2')
evalRes