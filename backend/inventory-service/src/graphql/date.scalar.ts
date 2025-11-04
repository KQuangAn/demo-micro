import { GraphQLScalarType, Kind } from 'graphql';
import type { ValueNode } from 'graphql/language/ast';

export const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Custom Date scalar type',
  parseValue: (value: number | string): Date => {
    return new Date(value);
  },

  serialize: (value: Date): number => {
    return value.getTime();
  },
  parseLiteral: (ast: ValueNode): Date => {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10));
    }
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    throw new TypeError('Invalid Date literal');
  },
});
