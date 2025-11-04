import { Decimal } from 'decimal.js';
import { GraphQLScalarType, Kind } from 'graphql';
import type { ValueNode } from 'graphql/language/ast';

export const DecimalScalar = new GraphQLScalarType({
  name: 'Decimal',
  description: 'Decimal scalar type',
  parseValue: (value: number | string): Decimal => {
    if (typeof value === 'number' || typeof value === 'string') {
      return new Decimal(value);
    }
    throw new TypeError('Invalid Decimal value');
  },

  serialize(value: Decimal): number {
    return value.toNumber();
  },

  parseLiteral(ast: ValueNode): Decimal {
    if (
      ast.kind === Kind.FLOAT ||
      ast.kind === Kind.INT ||
      ast.kind === Kind.STRING
    ) {
      return new Decimal(ast.value);
    }
    throw new TypeError('Invalid Decimal literal');
  },
});
