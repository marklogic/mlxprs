export function testOverrideQueryWithGoodJSON(): string {
    return `
/* mlxprs:settings

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
/* mlxprs:settings

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

export function testOverrideXQueryWithGoodJSON(): string {
    return `
(: mlxprs:settings

  {
    "host": "overrideHost",
    "port": 12345,
    "username": "blahpblorpbleepybloop"
  }

:)
(: Another comment :)
cts:doc(cts:uris()[12 + 19])
`
}

export function testOverrideXQueryWithBadJSON(): string {
    return `

(: mlxprs:settings

  {
    "host": 'overrideHost',
    "port": 12345,
    "username": "blahpblorpbleepybloop"
  }

:)
(: Another comment :)
(: another comment :)
cts:doc(cts:uris()[12 + 19])
`
}

export function testXQueryWithoutOverrides(): string {
    return `
(: ignore these settings!

  {
    "host": "overrideHost",
    "port": 12345,
    "username": "blahpblorpbleepybloop"
  }

:)
(: Another comment
 another block comment :)
cts.doc(cts.uris().toArray()[12 + 19])
`
}
