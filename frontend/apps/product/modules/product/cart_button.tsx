'use client';

import { MinusIcon, PlusIcon, ShoppingBasketIcon, X } from 'lucide-react';
import { useState } from 'react';
import { Spinner } from '../components/native/icons';
import { getCountInCart, getLocalCart } from '../lib/cart';
import {
  CartContextProvider,
  useCartContext,
} from '../providers/cart-provider';
import { Button } from '../components/ui/button';
import { TInventory } from '@repo/apollo-client';
import { TCart } from '../types';

export default function CartButton({ product }: TInventory) {
  return (
    <CartContextProvider>
      <ButtonComponent product={product} />
    </CartContextProvider>
  );
}

export function ButtonComponent({ product }: TInventory) {
  const { cart, dispatchCart } = useCartContext();
  const [itemCount, setItemCount] = useState(
    () => cart?.items?.find((item) => item?.productId == product.id)?.count || 0
  );
  console.log(cart);
  async function onAddToCart() {
    console.log('assdasdfdd');
    try {
      const localCart = getLocalCart() as TCart;

      // if already in cart => ++ 1
      if (localCart?.items?.findIndex((x) => x.productId == product.id) > 0) {
        for (let i = 0; i < localCart.items.length; i++) {
          if (
            localCart?.items[i]?.productId &&
            localCart?.items[i]?.productId === product?.id
          ) {
            localCart.items[i].count = itemCount;
          }
        }

        dispatchCart(localCart);
      } else {
        localCart.items.push({
          productId: product?.id,
          product,
          count: itemCount,
        });
        console.log('324');

        console.log(localCart);
        dispatchCart(localCart);
      }
    } catch (error) {
      console.error({ error });
    }
  }

  const onAddItemCount = () => {
    setItemCount((count) => (count++ > product.quantity ? count : count++));
  };
  const onDecreaseItemCount = () => {
    setItemCount((count) => (count-- >= 0 ? count-- : count));
  };

  if (itemCount === 0) {
    return (
      <Button className="flex gap-2" onClick={onAddItemCount}>
        <ShoppingBasketIcon className="h-4" /> Add to Cart
      </Button>
    );
  }
  if (itemCount > 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            size="icon"
            onClick={onDecreaseItemCount}
            className="flex-1"
          >
            {itemCount == 1 ? (
              <X className="h-4 w-4" />
            ) : (
              <MinusIcon className="h-4 w-4" />
            )}
          </Button>

          <Button disabled variant="outline" size="icon" className="flex-2">
            {itemCount}
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            size="icon"
            onClick={onAddItemCount}
          >
            <PlusIcon className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onAddToCart}
          className="flex-1 p-4 w-full"
        >
          Add
        </Button>
      </div>
    );
  }
}
