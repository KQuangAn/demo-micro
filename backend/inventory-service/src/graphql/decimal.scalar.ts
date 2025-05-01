import { Decimal } from 'decimal.js';
import { GraphQLScalarType, Kind } from 'graphql';

export const DecimalScalar = new GraphQLScalarType({
    name: "Decimal",
    description: 'Decimal scalar type',
    parseValue: (value: number): Decimal => {
        return new Decimal(value);
    },

    serialize(value: Decimal): number {
        return value.toNumber();
    },


    parseLiteral(ast: any): Decimal {
        if (ast.kind === Kind.FLOAT) {
            return new Decimal(ast.value);
        }
        return ast;
    }
})
