xquery version "1.0-ml";

import module namespace op="http://marklogic.com/optic" at "/MarkLogic/optic.xqy";

op:from-view('Medical', 'Authors')
   => op:select(('LastName', 'ForeName'))
   => op:order-by('LastName')
   => op:result()