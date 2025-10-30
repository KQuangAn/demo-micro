import { GraphQLScalarType, Kind } from 'graphql';

export const DateScalar = new GraphQLScalarType({
  name: 'Date',
  description: 'Custom Date scalar type',
  parseValue: (value: number): Date => {
    return new Date(value);
  },

  serialize: (value: Date): number => {
    return value.getTime();
  },
  parseLiteral: (ast: any): Date => {
    if (ast.kind === Kind.INT) {
      return new Date(parseInt(ast.value, 10));
    }
    return new Date(ast);
  },
});
