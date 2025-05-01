-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUM: Order Detail Status
CREATE TYPE order_detail_status AS ENUM (
    'pending',
    'validated',
    'delivering',
    'delivered',
    'completed',
    'cancelled'
);

-- Currency Table
CREATE TABLE currencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(3) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order Details Table
CREATE TABLE order_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    orders_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 1),
    currency_id UUID NOT NULL REFERENCES currencies(id),
    status order_detail_status NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Trigger function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_order_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_order_details_updated_at
BEFORE UPDATE ON order_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed currencies
INSERT INTO currencies (name) VALUES
    ('USD'),
    ('EUR'),
    ('GBP'),
    ('JPY'),
    ('VND');

-- Seed orders
INSERT INTO orders (user_id)
VALUES
    ('550e8400-e29b-41d4-a716-446655440000'),
    ('550e8400-e29b-41d4-a716-446655440002'),
    ('550e8400-e29b-41d4-a716-446655440004');

-- Seed order details
INSERT INTO order_details (orders_id, product_id, quantity,currency_id,  status)
VALUES
    ((SELECT id FROM orders WHERE user_id = '550e8400-e29b-41d4-a716-446655440000'), '550e8400-e29b-41d4-a716-446655440001', 2,(SELECT id FROM currencies WHERE name = 'USD') ,'pending'),
    ((SELECT id FROM orders WHERE user_id = '550e8400-e29b-41d4-a716-446655440002'), '550e8400-e29b-41d4-a716-446655440003', 5,(SELECT id FROM currencies WHERE name = 'USD') ,'pending'),
    ((SELECT id FROM orders WHERE user_id = '550e8400-e29b-41d4-a716-446655440004'), '550e8400-e29b-41d4-a716-446655440005', 1,(SELECT id FROM currencies WHERE name = 'USD') ,'completed');

-- Optional: quick check
SELECT * FROM orders;

SELECT * FROM order_details;

