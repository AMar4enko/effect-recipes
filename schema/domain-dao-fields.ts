/**
 * Schema transformation to rename Schema.Struct
 * fields during transcoding based on custom annotation
 */

import {
  SchemaAST as AST,
  Array,
  Effect,
  Match,
  Option,
  Schema as S,
  Tuple,
} from 'effect'
import { ParseIssue } from 'effect/ParseResult'
import {
  FinalTransformation,
  OptionalType,
  PropertySignature,
  Transformation,
  TupleType,
  Type,
  TypeLiteral,
} from 'effect/SchemaAST'

export const FieldName: unique symbol = Symbol(`FieldName`)

export const renameSchemaFields = <A, I, R>(s: S.Schema<A, I, R>) => {
  const modifyAst: (ast: AST.AST) => AST.AST = Match.type<AST.AST>().pipe(
    Match.tag(`TypeLiteral`, (ast) => {
      if (ast.propertySignatures.length > 0) {
        const signaturesWithEncodedFieldName = new Map(
          Array.getSomes(
            ast.propertySignatures.map((ps) =>
              AST.getAnnotation<string>(ps.type, FieldName).pipe(
                Option.map((fieldName) => Tuple.make(ps, fieldName)),
              ),
            ),
          ),
        )

        /**
         * Short curcuit, recursively mapping over proper signature types,
         * if there are no field name annotations for the struct props
         */
        if (signaturesWithEncodedFieldName.size == 0) {
          return new TypeLiteral(
            ast.propertySignatures.map((ps) => {
              return new PropertySignature(
                ps.name,
                modifyAst(ps.type),
                ps.isOptional,
                ps.isReadonly,
                ps.annotations,
              )
            }),
            ast.indexSignatures,
            {},
          )
        }

        /**
         * In order to rename fields on encoded side, we need to introduce transformation
         * between encoded and decoded versions of the struct
         * such that for all properties, on encoded side their respective types are Unknown
         * and on decoded side their respective types are recursively transformed.
         * Only properties with FieldName annotation are transformed.
         */

        const transformation = new FinalTransformation(
          (fromA: { [key: PropertyKey]: unknown }, options, self, fromI) => {
            // Decode
            return Effect.succeed(
              Object.fromEntries(
                ast.propertySignatures.map((ps) => {
                  const fieldName =
                    signaturesWithEncodedFieldName.get(ps) ?? ps.name
                  return [ps.name, fromA[fieldName]]
                }),
              ),
            )
          },
          (toI: { [key: PropertyKey]: unknown }, options, self, toA) => {
            // Encode
            return Effect.succeed(
              Object.fromEntries(
                ast.propertySignatures.map((ps) => {
                  const fieldName =
                    signaturesWithEncodedFieldName.get(ps) ?? ps.name

                  return [fieldName, toI[ps.name]]
                }),
              ),
            )
          },
        )

        const from = new TypeLiteral(
          ast.propertySignatures.map((ps) => {
            return new PropertySignature(
              signaturesWithEncodedFieldName.get(ps) ?? ps.name,
              S.Unknown.ast,
              ps.isOptional,
              ps.isReadonly,
              ps.annotations,
            )
          }),
          ast.indexSignatures,
          {},
        )

        const to = new TypeLiteral(
          ast.propertySignatures.map((ps) => {
            return new PropertySignature(
              ps.name,
              modifyAst(ps.type),
              ps.isOptional,
              ps.isReadonly,
              ps.annotations,
            )
          }),
          ast.indexSignatures,
          {},
        )

        return new Transformation(from, to, transformation, {})
      }

      return ast
    }),
    Match.tag(`TupleType`, (ast) => {
      const elements = ast.elements.map(
        (a) => new OptionalType(modifyAst(a.type), a.isOptional),
      )
      const rest = ast.rest.map(
        (a) => new Type(modifyAst(a.type), a.annotations),
      )

      return new TupleType(elements, rest, ast.isReadonly)
    }),
    Match.tag(`Transformation`, (ast) => {
      const newAst = new Transformation(
        modifyAst(ast.from),
        ast.to,
        ast.transformation,
      )

      return newAst
    }),
    Match.orElse((a) => a),
  )

  return S.make(modifyAst(s.ast)) as S.Schema<A, unknown, R>
}
