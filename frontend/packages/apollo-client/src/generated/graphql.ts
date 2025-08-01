import { gql } from '@apollo/client';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  Date: { input: any; output: any; }
  DateTime: { input: any; output: any; }
  Time: { input: any; output: any; }
  UUID: { input: any; output: any; }
  federation__FieldSet: { input: any; output: any; }
  link__Import: { input: any; output: any; }
  openfed__Scope: { input: any; output: any; }
};

export type CreateInventoryInput = {
  brand: Scalars['String']['input'];
  categories: Array<Scalars['String']['input']>;
  currencyName: Scalars['String']['input'];
  description: Scalars['String']['input'];
  images: Array<Scalars['String']['input']>;
  price: Scalars['Float']['input'];
  quantity: Scalars['Float']['input'];
  title: Scalars['String']['input'];
};

export type Inventory = {
  __typename?: 'Inventory';
  brand: Scalars['String']['output'];
  categories: Array<Scalars['String']['output']>;
  createdAt: Scalars['Date']['output'];
  currencyName: Scalars['String']['output'];
  description: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  images: Array<Scalars['String']['output']>;
  price: Scalars['Float']['output'];
  quantity: Scalars['Int']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['Date']['output'];
};

export type Mutation = {
  __typename?: 'Mutation';
  cancelOrder: Order;
  createInventory: Inventory;
  createNotification: NotificationType;
  handleReserveInventory: Array<Inventory>;
  removeInventory: Inventory;
  updateInventory: Inventory;
  updateOrderDetail: OrderDetail;
};


export type MutationCancelOrderArgs = {
  id: Scalars['UUID']['input'];
};


export type MutationCreateInventoryArgs = {
  createInventoryInput: CreateInventoryInput;
};


export type MutationCreateNotificationArgs = {
  eventType: Scalars['String']['input'];
  message: Scalars['String']['input'];
  subjectId: Scalars['String']['input'];
};


export type MutationHandleReserveInventoryArgs = {
  reserveInventoryInput: ReserveInventoryInput;
};


export type MutationRemoveInventoryArgs = {
  id: Scalars['String']['input'];
};


export type MutationUpdateInventoryArgs = {
  updateInventoryInput: UpdateInventoryInput;
};


export type MutationUpdateOrderDetailArgs = {
  orderDetailId: Scalars['UUID']['input'];
  quantity?: InputMaybe<Scalars['Int']['input']>;
  status?: InputMaybe<OrderDetailStatus>;
};

export type NotificationType = {
  __typename?: 'NotificationType';
  createdAt: Scalars['DateTime']['output'];
  id: Scalars['String']['output'];
  message: Scalars['String']['output'];
  status: Scalars['String']['output'];
  subjectId: Scalars['UUID']['output'];
  type: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type Order = {
  __typename?: 'Order';
  createdAt: Scalars['Time']['output'];
  id: Scalars['UUID']['output'];
  updatedAt: Scalars['Time']['output'];
  userId: Scalars['UUID']['output'];
};

export type OrderConnection = {
  __typename?: 'OrderConnection';
  edges: Array<OrderEdge>;
  pageInfo: PageInfo;
};

export type OrderDetail = {
  __typename?: 'OrderDetail';
  createdAt: Scalars['Time']['output'];
  currency: Scalars['String']['output'];
  id: Scalars['UUID']['output'];
  orderId: Scalars['UUID']['output'];
  price: Scalars['Float']['output'];
  productId: Scalars['UUID']['output'];
  quantity: Scalars['Int']['output'];
  status: OrderDetailStatus;
  updatedAt: Scalars['Time']['output'];
};

export type OrderDetailConnection = {
  __typename?: 'OrderDetailConnection';
  edges: Array<OrderDetailEdge>;
  pageInfo: PageInfo;
};

export type OrderDetailEdge = {
  __typename?: 'OrderDetailEdge';
  cursor: Scalars['Time']['output'];
  node: OrderDetail;
};

export enum OrderDetailStatus {
  Cancelled = 'cancelled',
  Completed = 'completed',
  Delivered = 'delivered',
  Delivering = 'delivering',
  Pending = 'pending',
  Validated = 'validated'
}

export type OrderEdge = {
  __typename?: 'OrderEdge';
  cursor: Scalars['Time']['output'];
  node: Order;
};

export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['Time']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['Time']['output']>;
};

export type ProductInput = {
  currency: Scalars['String']['input'];
  productId: Scalars['String']['input'];
  quantity: Scalars['Float']['input'];
};

export type Query = {
  __typename?: 'Query';
  allInventory: Array<Inventory>;
  allNotifications: Array<NotificationType>;
  getInventory: Inventory;
  getNotificationsBySubjectId: Array<NotificationType>;
  getOrderDetailsByOrderId: OrderDetailConnection;
  getOrdersByUserId: OrderConnection;
  notificationsByStatus: Array<NotificationType>;
};


export type QueryGetInventoryArgs = {
  id: Scalars['ID']['input'];
};


export type QueryGetNotificationsBySubjectIdArgs = {
  subjectId: Scalars['Int']['input'];
};


export type QueryGetOrderDetailsByOrderIdArgs = {
  after?: InputMaybe<Scalars['Time']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  orderId: Scalars['UUID']['input'];
};


export type QueryGetOrdersByUserIdArgs = {
  after?: InputMaybe<Scalars['Time']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  userId: Scalars['UUID']['input'];
};


export type QueryNotificationsByStatusArgs = {
  status: Scalars['String']['input'];
};

export type ReserveInventoryInput = {
  products: Array<ProductInput>;
  userId: Scalars['String']['input'];
};

export type UpdateInventoryInput = {
  brand?: InputMaybe<Scalars['String']['input']>;
  categories?: InputMaybe<Array<Scalars['String']['input']>>;
  description?: InputMaybe<Scalars['String']['input']>;
  id: Scalars['String']['input'];
  images?: InputMaybe<Array<Scalars['String']['input']>>;
  price?: InputMaybe<Scalars['Float']['input']>;
  quantity?: InputMaybe<Scalars['Float']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export enum Link__Purpose {
  /** `EXECUTION` features provide metadata necessary for operation execution. */
  Execution = 'EXECUTION',
  /** `SECURITY` features provide metadata necessary to securely resolve fields. */
  Security = 'SECURITY'
}
