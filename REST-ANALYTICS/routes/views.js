const express = require("express");
const { z } = require("zod");

const router = express.Router();

const ViewSchema = z.object({
    source: z.string(),
    url: z.string(),
    visitor: z.string(),
    createdAt: z.coerce.date(),  // accepte string, date ou timestamp
    meta: z.record(z.any())
});

router.post("/", async (req, res) => {
    const db = req.app.locals.db;
    const result = ViewSchema.safeParse(req.body);

    if (!result.success) return res.status(400).send(result.error);

    try {
        const ack = await db.collection("views").insertOne(result.data);
        res.status(201).send({ _id: ack.insertedId, ...result.data });
    } catch (err) {
        res.status(500).send("Erreur MongoDB : " + err.message);
    }
});

module.exports = router;
