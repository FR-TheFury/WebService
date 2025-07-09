const express = require("express");
const { z } = require("zod");

// Schéma Zod
const CategorySchema = z.object({
    _id: z.string(),
    name: z.string(),
});
const CreateCategorySchema = CategorySchema.omit({ _id: true });

// 👇 Export sous forme de fonction pour recevoir `io`
module.exports = function(io) {
    const router = express.Router();

    // 🔹 POST /categories
    router.post("/", async (req, res) => {
        const db = req.app.locals.db;
        const result = CreateCategorySchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).send(result.error);
        }

        try {
            const { name } = result.data;
            const ack = await db.collection("categories").insertOne({ name });

            const newCategory = {
                _id: ack.insertedId.toString(),
                name,
            };

            // 🚀 Émet l'événement "categories" avec type "create"
            io.emit("categories", {
                type: "create",
                category: newCategory,
            });

            res.status(201).send(newCategory);
        } catch (err) {
            res.status(500).send("Erreur MongoDB : " + err.message);
        }
    });

    return router;
};
