
CREATE TABLE inventory (
    id          VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    title       VARCHAR(255) NOT NULL,
    brand       VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    images      TEXT[] NOT NULL,  
    categories  TEXT[] NOT NULL,  
    quantity    INT NOT NULL,
    price       FLOAT NOT NULL,
    discount     FLOAT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP, 
    updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO inventory (id, title, brand, description, images, categories, quantity, price, discount, created_at, updated_at) VALUES
(gen_random_uuid(), 'Widget A', 'Brand X', 'High-quality widget for various applications', 
 ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], ARRAY['Tools', 'Gadgets'], 100, 19.99, 0.10, NOW(), NOW()),
(gen_random_uuid(), 'Widget B', 'Brand Y', 'Economical widget with basic features', 
 ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], ARRAY['Tools'], 200, 9.99, 0.05, NOW(), NOW()),
(gen_random_uuid(), 'Gadget X', 'Brand Z', 'Advanced gadget with innovative technology', 
 ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], ARRAY['Electronics'], 50, 49.99, 0.15, NOW(), NOW()),
(gen_random_uuid(), 'Gadget Y', 'Brand X', 'Compact gadget suitable for everyday use', 
 ARRAY['https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_.jpg'], ARRAY['Electronics', 'Accessories'], 75, 29.99, 0.20, NOW(), NOW());
 


select * from public.inventory i 