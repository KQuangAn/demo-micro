'use server';

import {
  GET_ALL_INVENTORY,
  GET_INVENTORY_ITEMS_PRICE_AND_QUANTITY_BY_ID,
  client,
  
}from '@repo/apollo-client';
import prisma from '../lib/prisma';

export const createOrder = () => {
  try {
    const res = prisma.$transaction(async (transaction) => {
      const inventoryInfo = await client.query({
        query: GET_INVENTORY_ITEMS_PRICE_AND_QUANTITY_BY_ID,
      });

      if (!inventoryInfo.data?.getInventory) {
        throw Error();
      }
      const inventoryPrice = inventoryInfo.data?.getInventory.price;
      const inventoryQuantity = inventoryInfo.data?.getInventory.price;

      


      return await Promise.all(createProductPromises);
    });
  } catch {}
};
