const express = require("express");
const { z } = require("zod");
const { ObjectId } = require("mongodb");

// Schémas
const ProductSchema = z.object({
    _id: z.string(),
    name: z.string(),
    about: z.string(),
    price: z.number().positive(),
    categoryIds: z.array(z.string()),
});
const CreateProductSchema = ProductSchema.omit({ _id: true });

// 👇 Export en tant que fonction pour recevoir `io`
module.exports = function(io) {
    const router = express.Router();

    // 🔹 CREATE
    router.post("/", async (req, res) => {
        const db = req.app.locals.db;
        const result = CreateProductSchema.safeParse(req.body);

        if (!result.success) return res.status(400).send(result.error);

        try {
            const { name, about, price, categoryIds } = result.data;
            const categoryObjectIds = categoryIds.map(id => new ObjectId(id));

            const ack = await db.collection("products").insertOne({
                name,
                about,
                price,
                categoryIds: categoryObjectIds,
            });

            const product = {
                _id: ack.insertedId.toString(),
                name,
                about,
                price,
                categoryIds,
            };

            io.emit("products", { type: "create", product });
            res.status(201).send(product);
        } catch (err) {
            res.status(500).send("Erreur MongoDB : " + err.message);
        }
    });

    // 🔹 GET /products/with-categories
    router.get("/with-categories", async (req, res) => {
        const db = req.app.locals.db;

        try {
            const products = await db.collection("products").aggregate([
                {
                    $lookup: {
                        from: "categories",
                        localField: "categoryIds",
                        foreignField: "_id",
                        as: "categories",
                    }
                }
            ]).toArray();

            res.json(products.map(p => ({
                ...p,
                _id: p._id.toString(),
                categories: p.categories.map(c => ({
                    ...c,
                    _id: c._id.toString()
                })),
            })));
        } catch (err) {
            res.status(500).send("Erreur MongoDB : " + err.message);
        }
    });

    // 🔹 GET /products
    router.get("/", async (req, res) => {
        const db = req.app.locals.db;

        try {
            const result = await db.collection("products").aggregate([
                { $match: {} },
                {
                    $lookup: {
                        from: "categories",
                        localField: "categoryIds",
                        foreignField: "_id",
                        as: "categories",
                    },
                },
            ]).toArray();

            const cleanResult = result.map(product => ({
                ...product,
                _id: product._id.toString(),
                categoryIds: product.categoryIds.map(id => id.toString()),
                categories: product.categories.map(cat => ({
                    ...cat,
                    _id: cat._id.toString(),
                })),
            }));

            res.send(cleanResult);
        } catch (err) {
            res.status(500).send("Erreur MongoDB : " + err.message);
        }
    });

    // 🔹 GET /products/:id
    router.get("/:id", async (req, res) => {
        const db = req.app.locals.db;
        const id = req.params.id;

        if (!ObjectId.isValid(id)) return res.status(400).send("ID invalide");

        try {
            const product = await db.collection("products").aggregate([
                { $match: { _id: new ObjectId(id) } },
                {
                    $lookup: {
                        from: "categories",
                        localField: "categoryIds",
                        foreignField: "_id",
                        as: "categories",
                    },
                },
            ]).toArray();

            if (product.length === 0) return res.status(404).send("Produit introuvable");

            const p = product[0];
            res.send({
                ...p,
                _id: p._id.toString(),
                categoryIds: p.categoryIds.map(id => id.toString()),
                categories: p.categories.map(cat => ({
                    ...cat,
                    _id: cat._id.toString()
                }))
            });
        } catch (err) {
            res.status(500).send("Erreur MongoDB : " + err.message);
        }
    });

    // 🔹 PUT /products/:id
    router.put("/:id", async (req, res) => {
        const db = req.app.locals.db;
        const id = req.params.id;

        if (!ObjectId.isValid(id)) return res.status(400).send("ID invalide");

        const result = CreateProductSchema.safeParse(req.body);
        if (!result.success) return res.status(400).send(result.error);

        try {
            const { name, about, price, categoryIds } = result.data;
            const categoryObjectIds = categoryIds.map(id => new ObjectId(id));

            const update = await db.collection("products").updateOne(
                { _id: new ObjectId(id) },
                { $set: { name, about, price, categoryIds: categoryObjectIds } }
            );

            if (update.matchedCount === 0) return res.status(404).send("Produit non trouvé");

            io.emit("products", {
                type: "update",
                product: {
                    _id: id,
                    name,
                    about,
                    price,
                    categoryIds,
                },
            });

            res.send({ message: "Produit mis à jour" });
        } catch (err) {
            res.status(500).send("Erreur MongoDB : " + err.message);
        }
    });

    // 🔹 DELETE /products/:id
    router.delete("/:id", async (req, res) => {
        const db = req.app.locals.db;
        const id = req.params.id;

        if (!ObjectId.isValid(id)) return res.status(400).send("ID invalide");

        try {
            const del = await db.collection("products").deleteOne({ _id: new ObjectId(id) });

            if (del.deletedCount === 0) return res.status(404).send("Produit introuvable");

            io.emit("products", { type: "delete", id });

            res.status(204).send(); // No Content
        } catch (err) {
            res.status(500).send("Erreur MongoDB : " + err.message);
        }
    });

    return router;
};
