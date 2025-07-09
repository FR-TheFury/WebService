const express = require("express");
const postgres = require("postgres");
const z = require("zod");
const crypto = require("crypto");
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const app = express();
const port = 8000;

// Connexion Postgres
const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    user: 'user',
    password: 'password'
});

app.use(express.json());

/* -----------------------------------
   SWAGGER SETUP
----------------------------------- */

const swaggerOptions = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Firelovers API",
            version: "1.0.0",
            description: "Documentation de l’API de démonstration avec Express, PostgreSQL et Zod"
        },
    },
    apis: [__filename],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* -----------------------------------
   PRODUCTS
----------------------------------- */

// Schémas Produits
const ProductSchema = z.object({
    id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive()
});
const CreateProductSchema = ProductSchema.omit({ id: true });

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Crée un nouveau produit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               about:
 *                 type: string
 *               price:
 *                 type: number
 *     responses:
 *       201:
 *         description: Produit créé
 */
app.post("/products", async (req, res) => {
    const result = CreateProductSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error);

    const { name, about, price } = result.data;
    const product = await sql`
        INSERT INTO products (name, about, price)
        VALUES (${name}, ${about}, ${price})
            RETURNING *`;
    res.status(201).send(product[0]);
});

// Recherche ou listing de tous les produits
app.get("/products", async (req, res) => {
    const { name, about, price } = req.query;
    const conditions = [];

    if (name) conditions.push(sql`name ILIKE ${'%' + name + '%'}`);
    if (about) conditions.push(sql`about ILIKE ${'%' + about + '%'}`);
    if (price && !isNaN(parseFloat(price))) {
        conditions.push(sql`price <= ${parseFloat(price)}`);
    }

    try {
        const products = await sql`
            SELECT * FROM products
                              ${conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``}
        `;
        res.send(products);
    } catch (err) {
        res.status(500).send({ message: "Erreur dans la recherche", error: err.message });
    }
});

// Récupération produit par ID (avec reviews)
app.get("/products/:id", async (req, res) => {
    const product = await sql`SELECT * FROM products WHERE id = ${req.params.id}`;
    if (product.length === 0) return res.status(404).send({ message: "Not found" });

    const reviews = await sql`SELECT * FROM reviews WHERE product_id = ${req.params.id}`;
    res.send({ ...product[0], reviews });
});

// Suppression produit
app.delete("/products/:id", async (req, res) => {
    const product = await sql`
        DELETE FROM products WHERE id=${req.params.id}
            RETURNING *
    `;
    if (product.length > 0) res.send(product[0]);
    else res.status(404).send({ message: "Not found" });
});

/* -----------------------------------
   USERS
----------------------------------- */

const UserSchema = z.object({
    id: z.string(),
    username: z.string(),
    email: z.string()
});

const CreateUserSchema = z.object({
    username: z.string(),
    email: z.string().email(),
    password: z.string().min(6)
});

function hashPassword(password) {
    return crypto.createHash("sha512").update(password).digest("hex");
}

// Création utilisateur
app.post("/users", async (req, res) => {
    const result = CreateUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error);

    const { username, email, password } = result.data;

    try {
        const hashed = hashPassword(password);
        const user = await sql`
            INSERT INTO users (username, email, password)
            VALUES (${username}, ${email}, ${hashed})
                RETURNING id, username, email
        `;
        res.status(201).send(user[0]);
    } catch (err) {
        res.status(500).send({ error: "User creation failed", details: err.message });
    }
});

// Mise à jour complète (PUT)
app.put("/users/:id", async (req, res) => {
    const result = CreateUserSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error);

    const { username, email, password } = result.data;
    const hashed = hashPassword(password);

    const updated = await sql`
        UPDATE users
        SET username = ${username}, email = ${email}, password = ${hashed}
        WHERE id = ${req.params.id}
            RETURNING id, username, email
    `;
    if (updated.length > 0) res.send(updated[0]);
    else res.status(404).send({ message: "User not found" });
});

// Mise à jour partielle (PATCH)
app.patch("/users/:id", async (req, res) => {
    const fields = [];
    const { username, email, password } = req.body;

    if (username) fields.push(sql`username = ${username}`);
    if (email) fields.push(sql`email = ${email}`);
    if (password) fields.push(sql`password = ${hashPassword(password)}`);

    if (fields.length === 0) {
        return res.status(400).send({ message: "No fields to update" });
    }

    const updated = await sql`
        UPDATE users
        SET ${sql.join(fields, sql`, `)}
        WHERE id = ${req.params.id}
            RETURNING id, username, email
    `;
    if (updated.length > 0) res.send(updated[0]);
    else res.status(404).send({ message: "User not found" });
});

// Listing users
app.get("/users", async (req, res) => {
    const users = await sql`SELECT id, username, email FROM users`;
    res.send(users);
});

/* -----------------------------------
   F2P GAMES (API externe)
----------------------------------- */

app.get("/f2p-games", async (req, res) => {
    try {
        const response = await fetch("https://www.freetogame.com/api/games");
        if (!response.ok) throw new Error("Erreur lors de la récupération");
        const games = await response.json();
        res.send(games);
    } catch (error) {
        res.status(500).send({ message: "Erreur de récupération", error: error.message });
    }
});

app.get("/f2p-games/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const response = await fetch(`https://www.freetogame.com/api/game?id=${id}`);
        if (!response.ok) return res.status(404).send({ message: "Jeu non trouvé" });
        const game = await response.json();
        res.send(game);
    } catch (error) {
        res.status(500).send({ message: "Erreur de récupération", error: error.message });
    }
});

/* -----------------------------------
   REVIEWS
----------------------------------- */

const CreateReviewSchema = z.object({
    userId: z.string().uuid(),
    productId: z.string().uuid(),
    score: z.number().int().min(1).max(5),
    content: z.string()
});

app.post("/reviews", async (req, res) => {
    const result = CreateReviewSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error);

    const { userId, productId, score, content } = result.data;

    try {
        const inserted = await sql`
            INSERT INTO reviews (user_id, product_id, score, content)
            VALUES (${userId}, ${productId}, ${score}, ${content})
            RETURNING *
        `;

        // Recalculer le score moyen
        const updatedScore = await sql`
            SELECT AVG(score)::numeric(3,2) AS average FROM reviews WHERE product_id = ${productId}
        `;

        await sql`
            UPDATE products
            SET average_score = ${updatedScore[0].average}
            WHERE id = ${productId}
        `;

        res.status(201).send(inserted[0]);
    } catch (err) {
        res.status(500).send({ message: "Erreur création review", error: err.message });
    }
});

/* -----------------------------------
   ORDERS (PANIER)
----------------------------------- */

const OrderSchema = z.object({
    id: z.string(),
    userId: z.string(),
    productIds: z.array(z.string()),
    total: z.number().nonnegative(),
    payment: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string()
});

const CreateOrderSchema = z.object({
    userId: z.string(),
    productIds: z.array(z.string().uuid())
});

// Création commande
app.post("/orders", async (req, res) => {
    const result = CreateOrderSchema.safeParse(req.body);
    if (!result.success) return res.status(400).send(result.error);

    const { userId, productIds } = result.data;

    try {
        const products = await sql`
            SELECT * FROM products
            WHERE id = ANY(${sql.array(productIds, 'uuid')})
        `;

        if (products.length !== productIds.length) {
            return res.status(400).send({ message: "Certains produits sont invalides." });
        }

        const subtotal = products.reduce((sum, p) => sum + parseFloat(p.price), 0);
        const total = +(subtotal * 1.2).toFixed(2);

        const order = await sql`
            INSERT INTO orders (user_id, product_ids, total)
            VALUES (${userId}, ${sql.array(productIds, 'uuid')}, ${total})
                RETURNING *
        `;

        res.status(201).send(order[0]);
    } catch (err) {
        res.status(500).send({ message: "Erreur lors de la création", error: err.message });
    }
});

// Liste des commandes avec user + produits
app.get("/orders", async (req, res) => {
    const orders = await sql`SELECT * FROM orders`;
    const results = [];

    for (const order of orders) {
        const user = await sql`SELECT id, username, email FROM users WHERE id = ${order.user_id}`;
        const products = await sql`
            SELECT * FROM products
            WHERE id = ANY(${sql.array(order.product_ids, 'uuid')})
        `;
        results.push({ ...order, user: user[0], products });
    }

    res.send(results);
});

// Récupération commande par ID
app.get("/orders/:id", async (req, res) => {
    const order = await sql`SELECT * FROM orders WHERE id = ${req.params.id}`;
    if (order.length === 0) return res.status(404).send({ message: "Not found" });

    const user = await sql`SELECT id, username, email FROM users WHERE id = ${order[0].user_id}`;
    const products = await sql`
        SELECT * FROM products
        WHERE id = ANY(${sql.array(order[0].product_ids, 'uuid')})
    `;

    res.send({ ...order[0], user: user[0], products });
});

// Mise à jour état du paiement
app.patch("/orders/:id", async (req, res) => {
    const { payment } = req.body;

    const updated = await sql`
        UPDATE orders
        SET payment = ${payment}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${req.params.id}
            RETURNING *
    `;
    if (updated.length === 0) return res.status(404).send({ message: "Not found" });
    res.send(updated[0]);
});

// Suppression commande
app.delete("/orders/:id", async (req, res) => {
    const deleted = await sql`DELETE FROM orders WHERE id = ${req.params.id} RETURNING *`;
    if (deleted.length === 0) return res.status(404).send({ message: "Not found" });
    res.send(deleted[0]);
});

/* -----------------------------------
   DÉMARRAGE DU SERVEUR
----------------------------------- */

app.listen(port, () => {
    console.log(`✅ API listening on http://localhost:${port}`);
    console.log(`📚 Swagger docs at http://localhost:${port}/api-docs`);
});
