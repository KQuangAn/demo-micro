import {
  client,
  GET_ORDERS_BY_USER_ID,
  QueryGetOrdersByUserIdArgs,
  Query,
} from '@repo/apollo-client';
import { Card, CardContent } from '../../modules/components/ui/card';
import { Button } from '../../modules/components/ui/button';
import Link from 'next/link';

const OrdersPage = async () => {
  const variables: QueryGetOrdersByUserIdArgs = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    first: 10,
    // after: someCursorValue // Uncomment and use if needed
  };

  const [ordersResult] = await Promise.allSettled([
    client.query<{ getOrdersByUserId: Query['getOrdersByUserId'] }>({
      query: GET_ORDERS_BY_USER_ID,
      variables,
    }),
  ]);

  if (ordersResult.status !== 'fulfilled') {
    return <div>Erorr fetching</div>;
  }

  const edges = ordersResult.value.data?.getOrdersByUserId?.edges;
  const orders = edges.map((x) => x?.node);

  return (
    <div className="flex flex-col gap-4">
      {orders.map((o) => (
        <Link key={o.id} href={`/orders/${o.id}`}>
          <Card>
            <CardContent className="p-4">Order {o.id}</CardContent>
            <CardContent className="p-4">Created at {o.createdAt}</CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
};

export default OrdersPage;
