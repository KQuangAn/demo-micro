import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { DataSection } from '../../../modules/product/data';
import Carousel from '../../../modules/components/native/Carousel';
import {
  GET_INVENTORY_ITEMS_BY_ID,
  inventoryClient,
  InventorySchema,
} from '@repo/apollo-client';
import { TInventory } from '@repo/apollo-client';

type Props = {
  params: { productId: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

// export async function generateMetadata(
//    { params, searchParams }: Props,
//    parent: ResolvingMetadata
// ): Promise<Metadata> {
//    const product = await prisma.product.findUnique({
//       where: {
//          id: params.productId,
//       },
//    })

//    return {
//       title: product.title,
//       description: product.description,
//       keywords: product.keywords,
//       openGraph: {
//          images: product.images,
//       },
//    }
// }

export default async function Product({
  params,
}: {
  params: { productId: string };
}) {
  const para = await params;
  const productId = para.productId;
  const res = await inventoryClient.query({
    query: GET_INVENTORY_ITEMS_BY_ID,
    variables: {
      id: productId,
    },
  });

  if (res?.error) {
    return <div>Error fetching data</div>;
  }
  console.log(res, 12341234);
  const product = res?.data?.getInventory;

  const validated = InventorySchema.safeParse(product);

  if (!validated.success) {
    <>Data contains error</>;
  }
  return (
    <>
      <Breadcrumbs product={product} />
      <div className="mt-6 grid grid-cols-1 gap-2 md:grid-cols-3">
        <ImageColumn product={product} />
        <DataSection product={product} />
      </div>
    </>
  );
}

const ImageColumn = ({ product }: { product: TInventory }) => {
  return (
    <div className="relative min-h-[50vh] w-full col-span-1">
      <Carousel images={product?.images} />
    </div>
  );
};

const Breadcrumbs = ({ product }: { product: TInventory }) => {
  return (
    <nav className="flex text-muted-foreground" aria-label="Breadcrumb">
      <ol className="inline-flex items-center gap-2">
        <li className="inline-flex items-center">
          <Link
            href="/"
            className="inline-flex items-center text-sm font-medium"
          >
            Home
          </Link>
        </li>
        <li>
          <div className="flex items-center gap-2">
            <ChevronRightIcon className="h-4" />
            <Link className="text-sm font-medium" href="/products">
              Products
            </Link>
          </div>
        </li>
        <li aria-current="page">
          <div className="flex items-center gap-2">
            <ChevronRightIcon className="h-4" />
            <span className="text-sm font-medium">{product?.title}</span>
          </div>
        </li>
      </ol>
    </nav>
  );
};
