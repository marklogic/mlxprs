const test = require('/test/test-helper.xqy');
const f = require('/lib/factorial.sjs');

let assertions = [];

assertions.push(
    test.assertEqual(1, f.factorial(1)),
    test.assertEqual(2, f.factorial(2)),
    test.assertEqual(6, f.factorial(3)),
    test.assertEqual(24, f.factorial(4)),
    test.assertEqual(120, f.factorial(5))
);

assertions;