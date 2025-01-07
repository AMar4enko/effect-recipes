import * as S from 'effect/Schema'
import { describe, expect, it } from 'vitest'
import { FieldName, renameSchemaFields } from './domain-dao-fields.ts'

const BooleanYesNo = S.transform(S.Literal(`Y`, `N`), S.Boolean, {
  encode(toI, toA) {
    return toA ? `Y` : `N`
  },
  decode(fromI, fromA) {
    return fromI === `Y`
  },
  strict: true,
})

const A = S.Struct({
  a: S.Struct({
    b: S.DateFromString.pipe(S.annotations({ [FieldName]: `b_1` })),
    c: BooleanYesNo.pipe(S.annotations({ [FieldName]: `c_1` })),
  }).pipe(S.annotations({ [FieldName]: `a_1` })),
})

const RenamedA = renameSchemaFields(A)

const encode = S.encodeSync(RenamedA)
const decode = S.decodePromise(RenamedA)

const a = {
  a: { b: new Date(`1970-01-01T00:00:00.000Z`), c: true },
}

const i = {
  a_1: { b_1: `1970-01-01T00:00:00.000Z`, c_1: `Y` },
}

describe(`renameSchemaFields`, () => {
  it(`correctly encodes renamed schema`, async () => {
    expect(encode(a)).toMatchObject(i)
  })

  it(`correctly decodes renamed schema`, async () => {
    await expect(decode(i)).resolves.toMatchObject(a)
  })
})
