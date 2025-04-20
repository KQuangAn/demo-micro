// mutations.ts
import { gql } from '@apollo/client';
import { TCreateInventoryInput, TUpdateInventoryInput, TRemoveInventoryInput } from './types';

export const CREATE_INVENTORY_ITEM = (input: TCreateInventoryInput) => gql`
  mutation CreateInventoryItem {
    createInventory(createInventoryInput: {
      name: "${input.name}"
      description: "${input.description || ''}"
      quantity: ${input.quantity}
      price: ${input.price}
    }) {
      id
      name
      description
      quantity
      price
      updatedAt
    }
  }
`;

export const UPDATE_INVENTORY_ITEM = (input: TUpdateInventoryInput) => gql`
  mutation UpdateInventoryItem {
    updateInventory(updateInventoryInput: {
      id: "${input.id}"
      name: "${input.name}"
      description: "${input.description || ''}"
      quantity: ${input.quantity}
      price: ${input.price}
    }) {
      id
      name
      description
      quantity
      price
      updatedAt
    }
  }
`;

export const REMOVE_INVENTORY_ITEM = (input: TRemoveInventoryInput) => gql`
  mutation RemoveInventoryItem {
    removeInventory(id: "${input.id}") {
      id
      name
      description
      quantity
      price
      updatedAt
    }
  }
`;