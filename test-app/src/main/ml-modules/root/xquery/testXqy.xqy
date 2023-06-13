xquery version "1.0-ml";

let $_ := xdmp:log($msg, [$level])
let $_ := fn:abs($arg)
let $_ := cts:and-query($queries, [$options])
return ()