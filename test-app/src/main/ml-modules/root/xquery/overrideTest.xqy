(: mlxprs:settings
{
"host": "macpro-6191.marklogic.com",
"managePort": 8052,
"port": 8057,
"contentDb": "mlxprs-test-content",
"modulesDb": "mlxprs-test-modules",
"user": "admin",
"pwd": "admin",
"note": "These settings are for testing only",
"ssl": true,
"rejectUnauthorized": false
}
:)
(:
,
"pathToCa": "/Users/pbarber/Documents/workspaces/engineering/GdsSelfSignedCert/fromTemplate.crt"
:)
xquery version "1.0-ml";

import module namespace hw = "helloworld" at "/xquery/library.xqy";

declare function local:factorial(
    $n as xs:unsignedLong?
) as xs:unsignedLong {
    if (fn:empty($n) or $n le 1) then
        1
    else
        $n * local:factorial(
            $n - 1
        )
};

let $_ := xdmp:log("running longTest.xqy")
let $three := 3
let $steps := (1, 2, $three)
let $squares :=
    for $step in $steps
    return $step * $step
let $_ := xdmp:log(("Squares", $squares))
let $result := local:factorial(7)
let $_ := xdmp:log(("Factorial result", $result))
return $result