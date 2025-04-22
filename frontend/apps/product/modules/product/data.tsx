import Link from 'next/link';

import CartButton from './cart_button';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';

export const DataSection = async ({ product }: { product: unknown }) => {
  function Price() {
    if (product?.discount > 0) {
      const price = product?.price - product?.discount;
      const percentage = (product?.discount / product?.price) * 100;
      return (
        <div className="flex gap-2 items-center">
          <Badge className="flex gap-4" variant="destructive">
            <div className="line-through">${product?.price}</div>
            <div>%{percentage.toFixed(2)}</div>
          </Badge>
          <h2 className="">${price.toFixed(2)}</h2>
        </div>
      );
    }

    return <h2>${product?.price}</h2>;
  }

  return (
    <div className="col-span-2 w-full rounded-lg bg-neutral-100 p-6 dark:bg-neutral-900">
      <h3 className="mb-4 text-xl font-medium">{product?.title}</h3>
      <Separator />
      <div className="flex gap-2 mb-2 items-center">
        <p className="text-sm">Brand:</p>
        <Link href={`/products?brand=${product?.brand}`}>
          <Badge variant="outline">{product?.brand}</Badge>
        </Link>
      </div>
      <div className="flex gap-2 items-center">
        <p className="text-sm">Categories:</p>
        {product?.categories?.map((category, index) => (
          <Link key={index} href={`/products?categories=${category}`}>
            <Badge variant="outline">{category}</Badge>
          </Link>
        ))}
      </div>
      <Separator />
      <small>{product?.description}</small>

      <Separator />
      <div className="block space-y-2">
        <Price />
        <div className="flex gap-2">
          <CartButton product={product} />

          <Badge variant="default">{product?.quantity} available</Badge>
        </div>
      </div>
    </div>
  );
};
