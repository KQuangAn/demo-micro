'use client';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { writeLocalCart, getLocalCart } from '../lib/cart';
import { TCart } from '../types/index';

const CartContext = createContext({
  cart: {
    items: [],
  },
  loading: false,
  refreshCart: () => {},
  dispatchCart: (cart: TCart) => {},
});

export const useCartContext = () => {
  return useContext(CartContext);
};

export const CartContextProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<TCart>(() => getLocalCart());
  const [loading, setLoading] = useState(false);

  const dispatchCart = async (cart: TCart) => {
    setCart(cart);
    writeLocalCart(cart);
  };

  const refreshCart = async () => {
    setLoading(true);
    //call api
    setCart(user?.cart);
    writeLocalCart(user?.cart);

    setLoading(false);
  };

  return (
    <CartContext.Provider value={{ cart, loading, refreshCart, dispatchCart }}>
      {children}
    </CartContext.Provider>
  );
};
