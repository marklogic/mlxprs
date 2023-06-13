xquery version '1.0-ml';

import module namespace test = 'http://marklogic.com/test' at '/test/test-helper.xqy';

(:
   This module will be run before each test in your suite.
   Here you might insert a document into the test database that each of your tests will modify.
   If no test-specific setup is required, this file may be deleted.
   Each setup runs in its own transaction.
:)
test:log("sample-tests Setup COMPLETE....")