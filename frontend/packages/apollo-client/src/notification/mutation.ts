import { gql } from '@apollo/client';
import { TInventory } from '../types/index.js';

export const CREATE_NOTIFICATION = (params: any) => gql`
  mutation {
    createNotification(
      userId: "${params.userId}",
      type: "${params.type}",
      status: "${params.status}",
      message: "${params.message || ''}"
    ) {
      userId
      type
      status
      message
      createdAt
      updatedAt
    }
  }
`;
