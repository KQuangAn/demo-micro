CREATE DATABASE IF NOT EXISTS orders;

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    productId VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    status VARCHAR(50) NOT NULL
);

INSERT INTO orders (product_id, quantity, status)
VALUES
    ('product_001', 10, 'pending'),
    ('product_002', 5, 'shipped'),
    ('product_003', 15, 'delivered');