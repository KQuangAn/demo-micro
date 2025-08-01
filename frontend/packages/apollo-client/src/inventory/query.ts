import { gql } from '@apollo/client';

export const GET_INVENTORY_ITEMS_BY_ID = gql`
  query GetInventory($id: ID!) {
    getInventory(id: $id) {
      id
      title
      brand
      description
      images
      categories
      quantity
      price
      currencyName
      createdAt
      updatedAt
    }
  }
`;

export const GET_INVENTORY_ITEMS_PRICE_AND_QUANTITY_BY_ID = gql`
  query GetInventoryPriceAndQuantity($id: ID!) {
    getInventory(id: $id) {
      quantity
      price
      currencyName
    }
  }
`;

export const GET_ALL_INVENTORY = gql`
  query {
    allInventory {
      id
      title
      brand
      description
      images
      categories
      quantity
      price
      currencyName
      createdAt
      updatedAt
    }
  }
`;

export const GET_ALL_CATEGORY = gql`
  query {
    allInventory {
      id
      categories
    }
  }
`;
