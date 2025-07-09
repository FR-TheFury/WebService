CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS products (
                                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    about TEXT NOT NULL,
    price NUMERIC NOT NULL CHECK (price > 0)
    );

CREATE TABLE IF NOT EXISTS users (
                                     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
    );

CREATE TABLE IF NOT EXISTS orders (
                                      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_ids UUID[] NOT NULL,
    total NUMERIC NOT NULL CHECK (total >= 0),
    payment BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

-- Ajout de la colonne average_score dans la table products si elle n’existe pas déjà
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS average_score NUMERIC(3,2);

-- Création de la table reviews
CREATE TABLE IF NOT EXISTS reviews (
                                       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    score INTEGER CHECK (score BETWEEN 1 AND 5) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
