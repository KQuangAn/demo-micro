'use client'

import { CartGrid } from "../../modules/cart/components/grid"
import { Heading } from "../../modules/components/native/heading"
import { CartContextProvider } from "../../modules/providers/cart-provider"



export default function Cart() {
   return (
      <CartContextProvider>
         <Heading
            title="Cart"
            description="Below is a list of products you have in your cart."
         />
         <CartGrid />
      </CartContextProvider>
   )
}
