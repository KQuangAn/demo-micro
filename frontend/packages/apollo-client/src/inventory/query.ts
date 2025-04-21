import { gql } from "@apollo/client";

export const GET_INVENTORY_ITEMS_BY_ID = gql`
  query GetInventory($id: ID!) {
    getInventory(id: $id) {
      id
      name
      description
      quantity
      price
      updatedAt
    }
  }
`;

export const GET_ALL_INVENTORY = gql`
  query {
    allInventory {
      id
      name
      description
      quantity
      price
      updatedAt
    }
  }
`;
