xquery version '1.0-ml';

import module namespace test = 'http://marklogic.com/test' at '/test/test-helper.xqy';

(:
   Runs once when your suite is started.
   You can use this to insert some data that will not be modified over the course of the suite's tests.
   If no suite-specific setup is required, this file may be deleted.
:)
test:log("SampleTestSuite Suite Setup COMPLETE....")