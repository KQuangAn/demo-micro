import { gql } from '@apollo/client';

export const CREATE_ORDER = gql`
  mutation createOrder($userID: ID!, $productId: ID!, $quantity: Int!) {
    createOrder(userID: $userID, productId: $productId, quantity: $quantity) {
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

// {
//   "userID": "e7cf02af-515d-42b2-bb6a-283bd3bf92d2",
//   "productId":"e7cf02af-515d-42b2-bb6a-283bd3bf92d2",
//   "quantity": 3
// }

export const UPDATE_ORDER = gql`
  mutation UpdateOrderDetail {
  updateOrderDetail(
    orderDetailId: "ORDER_DETAIL_ID_HERE"
    quantity: 2
    status: validated
  ) {
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
}
`;

export const CANCEL_ORDER = gql`
 mutation CancelOrder {
  cancelOrder(id: "ORDER_ID_HERE") {
    id
    userId
    createdAt
    updatedAt
  }
}
`;
