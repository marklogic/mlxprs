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
</stack>`;}

export function testLargerStackXml(): string {
    return `
    <stack xmlns="http://marklogic.com/xdmp/debug">
    <expr>
      <expr-id>919875312636655305</expr-id>
      <expr-source>let $date-part := fn:substring-before($string, "T") let $time-part := fn:substring-after($string, "T") let $new-time := fn:substring($time-part, 1, 2) || ":" || fn:substring($time-part, 3) || ":00Z" let $date := xs:dateTime($date-part || "T" || $new-time) return $date</expr-source>
      <uri>/ext/test-entity-lib.xqy</uri>
      <location>
        <database>3821057982388586813</database>
        <uri>/ext/test-entity-lib.xqy</uri>
      </location>
      <line>37</line>
      <column>2</column>
      <global-variables>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">MAPPING_COLLECTION</name>
          <prefix>es</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="http://test.poc/test/entity-lib">gen-pred</name>
          <prefix />
        </global-variable>
        <global-variable>
          <name xmlns="http://test.poc/test/config">GLOBAL-CONFIG</name>
          <prefix>config</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">FNDEF</name>
          <prefix>es</prefix>
        </global-variable>
      </global-variables>
      <external-variables />
    </expr>
    <frame>
      <uri>/ext/test-entity-lib.xqy</uri>
      <location>
        <database>3821057982388586813</database>
        <uri>/ext/test-entity-lib.xqy</uri>
      </location>
      <line>37</line>
      <column>2</column>
      <operation>test-entity-lib:parse-scheduled-load-time-as-utc("2020-05-07T1800")</operation>
      <global-variables>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">MAPPING_COLLECTION</name>
          <prefix>es</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="http://namespace.poc/test/entity-lib">gen-pred</name>
          <prefix />
        </global-variable>
        <global-variable>
          <name xmlns="http://namespace.poc/test/config">GLOBAL-CONFIG</name>
          <prefix>config</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">FNDEF</name>
          <prefix>es</prefix>
        </global-variable>
      </global-variables>
      <external-variables />
      <variables>
        <variable>
          <name xmlns="http://namespace.poc/test/entity-lib">string</name>
          <prefix />
          <value>"2020-05-07T1800"</value>
        </variable>
      </variables>
    </frame>
    <frame>
      <line>34</line>
      <column>6</column>
      <operation>plugin:create-content("/test_DOC_DOCURI_2020-05-07T1800.xml", map:map())</operation>
      <global-variables>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">MAPPING_COLLECTION</name>
          <prefix>es</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="">options</name>
          <value>map:map()</value>
          <prefix />
        </global-variable>
        <global-variable>
          <name xmlns="http://namespace.poc/test/entity-lib">gen-pred</name>
          <prefix>test-entity-lib</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="">id</name>
          <value>"/test_DOC_DOCURI_2020-05-07T1800.xml"</value>
          <prefix />
        </global-variable>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">FNDEF</name>
          <prefix>es</prefix>
        </global-variable>
      </global-variables>
      <external-variables />
      <variables>
        <variable>
          <name xmlns="">id</name>
          <prefix />
          <value>"/test_DOC_DOCURI_2020-05-07T1800.xml"</value>
        </variable>
        <variable>
          <name xmlns="">options</name>
          <prefix />
          <value>map:map()</value>
        </variable>
        <variable>
          <name xmlns="">validation-report</name>
          <prefix />
          <value>&lt;val:validation-report document-uri="/test_DOC_DOCURI_2020-05-07T1800.xml" .../&gt;</value>
        </variable>
        <variable>
          <name xmlns="">validation-dateStamp</name>
          <prefix />
          <value>xs:dateTime("2020-05-06T18:01:59.999807Z")</value>
        </variable>
        <variable>
          <name xmlns="">doc</name>
          <prefix />
          <value>fn:doc("/test_DOC_DOCURI_2020-05-07T1800.xml")</value>
        </variable>
      </variables>
    </frame>
    <frame>
      <line>75</line>
      <column>0</column>
      <global-variables>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">MAPPING_COLLECTION</name>
          <prefix>es</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="">options</name>
          <value>map:map()</value>
          <prefix />
        </global-variable>
        <global-variable>
          <name xmlns="http://namespace.poc/test/entity-lib">gen-pred</name>
          <prefix>test-entity-lib</prefix>
        </global-variable>
        <global-variable>
          <name xmlns="">id</name>
          <value>"/test_DOC_DOCURI_2020-05-07T1800.xml"</value>
          <prefix />
        </global-variable>
        <global-variable>
          <name xmlns="http://marklogic.com/entity-services">FNDEF</name>
          <prefix>es</prefix>
        </global-variable>
      </global-variables>
      <external-variables />
      <variables />
    </frame>
  </stack>`;
}

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
</a>`;
}
