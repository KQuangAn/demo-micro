export function getOrderBy(sort) {
  let orderBy;

  switch (sort) {
    case 'featured':
      orderBy = {
        orders: {
          _count: 'desc',
        },
      };
      break;
    case 'most_expensive':
      orderBy = {
        price: 'desc',
      };
      break;
    case 'least_expensive':
      orderBy = {
        price: 'asc',
      };
      break;

    default:
      orderBy = {
        orders: {
          _count: 'desc',
        },
      };
      break;
  }

  return orderBy;
}
