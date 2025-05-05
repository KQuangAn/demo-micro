import Carousel from '../modules/components/native/Carousel';
import {
  ProductGrid,
  ProductSkeletonGrid,
} from '../modules/components/native/Product';
import { isVariableValid } from '../modules/lib/utils';
import { Heading } from '../modules/components/native/heading';
import { mockProducts } from '../modules/mock';
import { banners } from '../modules/constant';
import { getOrderBy } from '../modules/utils';
import {
  SortBy,
  CategoriesCombobox,
  AvailableToggle,
} from '../modules/product/options';
import { Separator } from '../modules/components/ui/separator';
import {
  GET_ALL_CATEGORY,
  GET_ALL_INVENTORY,
  client,
} from '@repo/apollo-client';

export default async function Index({
  searchParams,
}: {
  searchParams: unknown;
}) {
  const {
    sort,
    isAvailable,
    brand,
    category,
    page = 1,
  } = (await searchParams) ?? null;

  const [productsResult, categoriesResult] = await Promise.allSettled([
    client.query({ query: GET_ALL_INVENTORY }),
    client.query({ query: GET_ALL_CATEGORY }),
  ]);

  if (
    productsResult?.status == 'rejected' ||
    categoriesResult?.status == 'rejected'
  ) {
    return <>Error</>;
  }

  const products = productsResult?.value?.data?.allInventory;
  const categories = categoriesResult?.value?.data?.allInventory;

  return (
    <div className="flex flex-col border-neutral-200 dark:border-neutral-700">
      <Carousel images={banners} />
      <Separator className="my-8" />
      <Heading
        title="Products"
        description="Below is a list of products we have available for you."
      />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
        <SortBy initialData={sort} />
        <CategoriesCombobox
          initialCategory={category}
          categories={categories}
        />
        <AvailableToggle initialData={isAvailable} />
      </div>
      <Separator />

      {isVariableValid(products) ? (
        <ProductGrid products={products} />
      ) : (
        <ProductSkeletonGrid />
      )}
      <Separator className="my-8" />
    </div>
  );
}
