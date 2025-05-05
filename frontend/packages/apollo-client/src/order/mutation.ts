import { gql } from '@apollo/client';

export const CREATE_ORDER = gql`
  mutation createOrder($userId: UUID!, $productId: UUID!, $quantity: Int!) {
    createOrder(userId: $userId, productId: $productId, quantity: $quantity) {
      id
      userId
      productId
      quantity
      status
      createdAt
      updatedAt
    }
  }
`;

// Example variables for creating an order
// {
//   "userId": "e7cf02af-515d-42b2-bb6a-283bd3bf92d2",
//   "productId": "e7cf02af-515d-42b2-bb6a-283bd3bf92d2",
//   "quantity": 3
// }

export const UPDATE_ORDER = gql`
  mutation UpdateOrderDetail(
    $orderDetailId: UUID!
    $quantity: Int
    $status: OrderDetailStatus
  ) {
    updateOrderDetail(
      orderDetailId: $orderDetailId
      quantity: $quantity
      status: $status
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
  mutation CancelOrder($id: UUID!) {
    cancelOrder(id: $id) {
      id
      userId
      createdAt
      updatedAt
    }
  }
`;
