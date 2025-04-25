import { TCart } from '../types';

export function writeLocalCart(items: unknown) {
  window.localStorage.setItem('Cart', JSON.stringify(items));
}

export function getLocalCart(): TCart {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cart = window.localStorage.getItem('Cart');
      if (cart == null) {
        throw Error;
      }
      return JSON.parse(cart);
    } catch (error) {
      writeLocalCart({ items: [] });
      return { items: [] };
    }
  } else {
    return { items: [] };
  }
}

export function getCountInCart({
  cartItems,
  productId,
}: {
  cartItems: unknown[];
  productId: string;
}) {
  try {
    for (let i = 0; i < cartItems?.length; i++) {
      if (cartItems[i]?.productId === productId) {
        return cartItems[i]?.count;
      }
    }

    return 0;
  } catch (error) {
    console.error({ error });
    return 0;
  }
}
