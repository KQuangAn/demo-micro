import { gql } from '@apollo/client';

export const GET_NOTIFICATION_ITEMS_BY_USER_ID = (userId: string) => gql`
  query {
    notificationsByUser(userId: ${userId}) {
      id
      userId
      type
      message
      status
      createdAt
      updatedAt
    }
  }
`;
export const GET_NOTIFICATION_ITEMS_BY_STATUS = (status: any) => gql`
  query {
    notificationsByStatus(status: ${status}) {
      id
      userId
      type
      message
      status
      createdAt
      updatedAt
    }
  }
`;

export const GET_ALL_NOTIFICATIONS = gql`
  query {
    allNotifications {
      id
      userId
      message
      status
      createdAt
      updatedAt
    }
  }
`;
