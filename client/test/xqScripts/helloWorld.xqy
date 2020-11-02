xquery version "1.0-ml";

declare namespace hw = 'http://mlxprs.test/';

declare function hw:loop() {
  let $j :=
    for $i in 1 to 30
    return $i
  return fn:sum($j)
};

let $str := 'Hello World XQY' (: <-- debugger will start here :)
let $str2 := 'line 2'
let $str3 := 'line 3'
let $num := hw:loop()
let $str4 := 'line 4'
let $str5 := 'line 5'

return $num
