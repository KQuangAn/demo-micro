import { gql } from '@apollo/client';

export const GET_ALL_ORDERS = gql`
  query {
    orders {
      id
      userID
      productId
      quantity
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_ORDER_BY_ID = gql`
  query getOrder($id: ID!) {
    order(id: $id) {
      id
      userID
      productId
      quantity
      status
      createdAt
      updatedAt
    }
  }
`;
