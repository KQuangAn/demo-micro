CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Currencies Table
CREATE TABLE currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(3) NOT NULL UNIQUE, -- e.g., USD, EUR
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some currency data
INSERT INTO currencies (name) 
VALUES ('USD'), ('EUR'), ('VND'), ('JPY');

-- Create Category Table ?
 

-- Create Inventory Table (Fix UUID Type)
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), -- Use UUID directly
    title VARCHAR(255) NOT NULL,
    brand VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    images TEXT[] NOT NULL,
    categories TEXT[] NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
-- Insert Inventory Items (Fixed price reference, move price to prices table)
INSERT INTO inventory (title, brand, description, images, categories, quantity, created_at, updated_at) 
VALUES
  ('Widget A', 'Brand X', 'High-quality widget for various applications', 
   ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], 
   ARRAY['Tools', 'Gadgets'], 100, NOW(), NOW()),
  ('Widget B', 'Brand Y', 'Economical widget with basic features', 
   ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], 
   ARRAY['Tools'], 200, NOW(), NOW()),
  ('Gadget X', 'Brand Z', 'Advanced gadget with innovative technology', 
   ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], 
   ARRAY['Electronics'], 50, NOW(), NOW()),
  ('Gadget Y', 'Brand X', 'Compact gadget suitable for everyday use', 
   ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], 
   ARRAY['Electronics', 'Accessories'], 75, NOW(), NOW());

  
  -- Create Prices Table (For Multiple Currencies)
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE, -- Link to inventory item
  currency_id UUID NOT NULL REFERENCES currencies(id), -- Link to the currency
  price NUMERIC NOT NULL CHECK (price >= 0), -- Price for the product in the given currency
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When the price became effective
  end_date TIMESTAMP, -- When the price stops being effective, null means current
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert Prices for Products in Different Currencies
-- Widget A with different prices
INSERT INTO prices (product_id, currency_id, price, start_date) 
VALUES 
  ((SELECT id FROM inventory WHERE title = 'Widget A'), (SELECT id FROM currencies WHERE name = 'USD'), 19.99, NOW()),
  ((SELECT id FROM inventory WHERE title = 'Widget A'), (SELECT id FROM currencies WHERE name = 'EUR'), 18.99, NOW()),

-- Widget B with different prices
  ((SELECT id FROM inventory WHERE title = 'Widget B'), (SELECT id FROM currencies WHERE name = 'USD'), 9.99, NOW()),
  ((SELECT id FROM inventory WHERE title = 'Widget B'), (SELECT id FROM currencies WHERE name = 'EUR'), 8.99, NOW()),

-- Gadget X with different prices
  ((SELECT id FROM inventory WHERE title = 'Gadget X'), (SELECT id FROM currencies WHERE name = 'USD'), 49.99, NOW()),
  ((SELECT id FROM inventory WHERE title = 'Gadget X'), (SELECT id FROM currencies WHERE name = 'EUR'), 47.99, NOW()),

-- Gadget Y with different prices
  ((SELECT id FROM inventory WHERE title = 'Gadget Y'), (SELECT id FROM currencies WHERE name = 'USD'), 29.99, NOW()),
  ((SELECT id FROM inventory WHERE title = 'Gadget Y'), (SELECT id FROM currencies WHERE name = 'EUR'), 27.99, NOW());

-- Query to get the latest price for each product in a specific currency (e.g., USD)
SELECT 
  p.product_id,
  p.price,
  p.start_date,
  p.end_date,
  c.name AS currency_name
FROM 
  prices p
JOIN 
  currencies c ON p.currency_id = c.id
WHERE 
  p.product_id = (SELECT id FROM inventory WHERE title = 'Widget A') -- You can change this to any product
  AND p.start_date = (SELECT MAX(start_date) FROM prices WHERE product_id = p.product_id AND currency_id = p.currency_id)
ORDER BY 
  p.start_date DESC;

-- Query inventory items
SELECT * FROM inventory;
