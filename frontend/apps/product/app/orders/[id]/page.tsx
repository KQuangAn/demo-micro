import {
  client,
  GET_ORDER_DETAILS_BY_ORDER_ID,
  GET_ORDERS_BY_USER_ID,
  Query,
  QueryGetOrderDetailsByOrderIdArgs,
} from '@repo/apollo-client';
import { Card, CardContent } from '../../../modules/components/ui/card';
import Link from 'next/link';

const OrdersIdPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const varible: QueryGetOrderDetailsByOrderIdArgs = {
    orderId: id,
    first: 10,
    //after
  };
  const [result] = await Promise.allSettled([
    client.query<{
      getOrderDetailsByOrderId: Query['getOrderDetailsByOrderId'];
    }>({
      query: GET_ORDER_DETAILS_BY_ORDER_ID,
      variables: varible,
    }),
  ]);
  if (result.status !== 'fulfilled') {
    return <div>Erorr fetching</div>;
  }

  const edges = result.value.data.getOrderDetailsByOrderId.edges;
  const items = edges.map((x) => x?.node);
  console.log(result, items);
  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <Link key={item.id} href={`/products/${item.productId}`}>
          <Card className="p-2 flex flex-col gap-2">
            <CardContent>ProductId {item.productId}</CardContent>
            <CardContent>Order price{item.price}</CardContent>
            <CardContent>Quantiity {item.quantity}</CardContent>
            <CardContent>Currency {item.currency}</CardContent>
            <CardContent>Created at {item.status}</CardContent>
            <CardContent>Created at {item.createdAt}</CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default OrdersIdPage;
