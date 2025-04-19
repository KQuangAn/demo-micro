"use client";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { writeLocalCart, getLocalCart } from "../lib/cart";

const CartContext = createContext({
  cart: null,
  loading: true,
  refreshCart: () => {},
  dispatchCart: (object: unknown) => {},
});

export const useCartContext = () => {
  return useContext(CartContext);
};

export const CartContextProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState(() => getLocalCart());
  const [loading, setLoading] = useState(true);

  const dispatchCart = async (cart) => {
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
