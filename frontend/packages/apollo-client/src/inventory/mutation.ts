import { gql } from '@apollo/client';
import { TInventory } from '../types/index.js';

export const CREATE_INVENTORY_ITEM = (input: TInventory) => gql`
  mutation CreateInventoryItem {
    createInventory(createInventoryInput: {
      title: "${input.title}"
      brand: "${input.brand}"
      description: "${input.description || ''}"
      images: ${JSON.stringify(input.images)}
      categories: ${JSON.stringify(input.categories)}
      quantity: ${input.quantity}
      price: ${input.price}
      discount: ${input.discount}
    }) {
      id
      title
      brand
      description
      images
      categories
      quantity
      price
      discount
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_INVENTORY_ITEM = (input: TInventory) => gql`
  mutation UpdateInventoryItem {
    updateInventory(updateInventoryInput: {
      id: "${input.id}"
      title: "${input.title}"
      brand: "${input.brand}"
      description: "${input.description || ''}"
      images: ${JSON.stringify(input.images)}
      categories: ${JSON.stringify(input.categories)}
      quantity: ${input.quantity}
      price: ${input.price}
      discount: ${input.discount}
    }) {
      id
      title
      brand
      description
      images
      categories
      quantity
      price
      discount
      createdAt
      updatedAt
    }
  }
`;

export const REMOVE_INVENTORY_ITEM = (id: string) => gql`
  mutation RemoveInventoryItem {
    removeInventory(id: "${id}") {
      id
      title
      brand
      description
      images
      categories
      quantity
      price
      discount
      createdAt
      updatedAt
    }
  }
`;
