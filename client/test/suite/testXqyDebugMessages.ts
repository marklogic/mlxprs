export function testStackXml(): string {
    return `<stack xmlns="http://marklogic.com/xdmp/debug">
  <expr>
    <expr-id>9444875716397283355</expr-id>
    <expr-source>for $row in $rows let $row-idx := $row let $row-uri := fn:string-join(($prefix, $filename, "row", $row-idx || ".json"), "/") return xdmp:document-insert($row-uri, $row)</expr-source>
    <uri>/test-module.xqy</uri>
    <line>8</line>
    <column>0</column>
    <global-variables>
      <global-variable>
        <name xmlns="">rows</name>
        <prefix></prefix>
      </global-variable>
      <global-variable>
        <name xmlns="">prefix</name>
        <prefix></prefix>
      </global-variable>
      <global-variable>
        <name xmlns="">filename</name>
        <prefix></prefix>
      </global-variable>
    </global-variables>
    <external-variables></external-variables>
  </expr>
  <frame>
    <line>8</line>
    <column>0</column>
    <global-variables>
      <global-variable>
        <name xmlns="">rows</name>
        <prefix></prefix>
      </global-variable>
      <global-variable>
        <name xmlns="">prefix</name>
        <prefix></prefix>
      </global-variable>
      <global-variable>
        <name xmlns="">filename</name>
        <prefix></prefix>
      </global-variable>
    </global-variables>
    <external-variables></external-variables>
    <variables></variables>
  </frame>
  <frame>
    <line>9</line>
    <column>0</column>
    <global-variables>
      <global-variable>
        <name xmlns="">rows</name>
        <prefix></prefix>
      </global-variable>
      <global-variable>
        <name xmlns="">prefix</name>
        <prefix></prefix>
      </global-variable>
      <global-variable>
        <name xmlns="">filename</name>
        <prefix></prefix>
      </global-variable>
    </global-variables>
    <external-variables></external-variables>
    <variables></variables>
  </frame>
</stack>`}

export function testExprXml(): string {
    return `<a>
    <expr xmlns="http://marklogic.com/xdmp/debug">
    <expr-id>3023757983150276589</expr-id>
    <expr-source>for $row in $rows let $row-idx := $row let $row-uri := fn:string-join(($prefix, $filename, "row", $row-idx || ".json"), "/") return xdmp:document-insert($row-uri, $row)</expr-source>
    <uri></uri>
    <line>7</line>
    <column>0</column>
    <statements></statements>
  </expr>
  <expr xmlns="http://marklogic.com/xdmp/debug">
    <expr-id>2110626143992423407</expr-id>
    <expr-source>xdmp:document-insert($row-uri, $row)</expr-source>
    <uri></uri>
    <line>10</line>
    <column>7</column>
    <statements></statements>
  </expr>
</a>`
}
