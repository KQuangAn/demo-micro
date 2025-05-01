import { useSuspenseQuery } from "@apollo/client";
import { GET_ALL_ORDERS } from "@repo/apollo-client";
import Link from "next/link";

const OrdersPage = () => {
  const { data } = useSuspenseQuery(GET_ALL_ORDERS, { variables: { foo: 1 } });

  return (
    <div>qwefqwef</div>
  );
};

export default OrdersPage;
