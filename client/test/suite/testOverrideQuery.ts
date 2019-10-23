export function testOverrideQueryWithGoodJSON(): string {
    return `
/* settings:mlxprs

  {
    "host": "overrideHost",
    "port": 12345,
    "username": "blahpblorpbleepybloop"
  }

*/
// Another comment
/* another block comment */
cts.doc(cts.uris().toArray()[12 + 19])
`
}

export function testOverrideQueryWithBadJSON(): string {
    return `
/* settings:mlxprs

  {
    "host": 'overrideHost',
    "port": 12345,
    "username": "blahpblorpbleepybloop"
  }

*/
// Another comment
/* another block comment */
cts.doc(cts.uris().toArray()[12 + 19])
`
}

export function testQueryWithoutOverrides(): string {
    return `
/* ignore these settings!

  {
    "host": "overrideHost",
    "port": 12345,
    "username": "blahpblorpbleepybloop"
  }

*/
// Another comment
/* another block comment */
cts.doc(cts.uris().toArray()[12 + 19])
`
}

