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
  query getOrdersByUserId($userId: UUID!, $first: Int, $after: Time) {
    getOrdersByUserId(userId: $userId, first: $first, after: $after) {
      edges {
        node {
          id
          userId
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

export const GET_ORDER_DETAILS_BY_ORDER_ID = gql`
  query GetOrderDetailsByOrderId($orderId: UUID!, $first: Int, $after: Time) {
    getOrderDetailsByOrderId(orderId: $orderId, first: $first, after: $after) {
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
