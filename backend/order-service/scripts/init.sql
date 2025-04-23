

-- Create the orders table with UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- Enable the UUID extension

CREATE TYPE order_status AS ENUM ('Pending', 'Processing', 'Completed', 'Cancelled');


CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    product_id UUID NOT NULL,
    quantity INT NOT NULL CHECK (quantity >= 1),
    status order_status NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data into the orders table
INSERT INTO orders (id, user_id, product_id, quantity, status, created_at, updated_at)
VALUES
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', 2, 'PENDING', NOW(), NOW()),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 5, 'PENDING', NOW(), NOW()),
    (uuid_generate_v4(), '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440005', 1, 'COMPLETED', NOW(), NOW());
    
   
select * from orders o 