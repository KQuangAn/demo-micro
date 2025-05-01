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

export const GET_ORDERS_BY_USER_ID = gql`
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

export const GET_ORDER_DETAILS_BY_ORDER_ID = gql`
 query GetOrderDetailsByOrderId {
  getOrderDetailsByOrderId(orderId: "ORDER_ID_HERE", first: 10, after: "CURSOR_HERE") {
    edges {
      node {
        id
        orderId
        productId
        quantity
        price
        currency
        status
        createdAt
        updatedAt
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}
`;
