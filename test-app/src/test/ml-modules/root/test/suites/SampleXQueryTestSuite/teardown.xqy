xquery version '1.0-ml';

import module namespace test = 'http://marklogic.com/test' at '/test/test-helper.xqy';

(:
   This module will run after each test in your suite.
   You might use this module to remove the document inserted by the test setup module.
   If no test-specific teardown is required, this file may be deleted.
:)
test:log("sample-tests Teardown COMPLETE....")