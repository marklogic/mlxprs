export function testStackXml(): string {
    return `<stack xmlns="http://marklogic.com/xdmp/debug">
  <expr>
    <expr-id>9444875716397283355</expr-id>
    <expr-source>for $row in $rows let $row-idx := $row let $row-uri := fn:string-join(($prefix, $filename, "row", $row-idx || ".json"), "/") return xdmp:document-insert($row-uri, $row)</expr-source>
    <uri></uri>
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
