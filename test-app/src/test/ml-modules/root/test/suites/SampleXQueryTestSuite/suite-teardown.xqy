xquery version '1.0-ml';

import module namespace test = 'http://marklogic.com/test' at '/test/test-helper.xqy';

(:
   Runs once when your suite is finished, to clean up after the suite's tests.
   If no suite-specific teardown is required, this file may be deleted.
:)
test:log("SampleTestSuite Suite Teardown ENDING....")