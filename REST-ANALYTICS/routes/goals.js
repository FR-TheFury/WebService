const express = require("express");
const { z } = require("zod");
const { ObjectId } = require("mongodb");

const router = express.Router();

const GoalSchema = z.object({
    source: z.string(),
    url: z.string(),
    goal: z.string(),
    visitor: z.string(),
    createdAt: z.coerce.date(),
    meta: z.record(z.any())
});

router.post("/", async (req, res) => {
    const db = req.app.locals.db;
    const result = GoalSchema.safeParse(req.body);

    if (!result.success) return res.status(400).send(result.error);

    try {
        const ack = await db.collection("goals").insertOne(result.data);
        res.status(201).send({ _id: ack.insertedId, ...result.data });
    } catch (err) {
        res.status(500).send("Erreur MongoDB : " + err.message);
    }
});


// 🔍 ROUTE D’AGRÉGATION : /goals/:goalId/details
router.get("/:goalId/details", async (req, res) => {
    const db = req.app.locals.db;
    const goalId = req.params.goalId;

    if (!ObjectId.isValid(goalId)) {
        return res.status(400).send("ID invalide");
    }

    try {
        const goal = await db.collection("goals").findOne({ _id: new ObjectId(goalId) });

        if (!goal) {
            return res.status(404).send("Goal non trouvé");
        }

        const visitor = goal.visitor;

        const [views, actions] = await Promise.all([
            db.collection("views").find({ visitor }).toArray(),
            db.collection("actions").find({ visitor }).toArray()
        ]);

        res.send({
            goal: {
                ...goal,
                _id: goal._id.toString()
            },
            views: views.map(v => ({ ...v, _id: v._id.toString() })),
            actions: actions.map(a => ({ ...a, _id: a._id.toString() })),
        });
    } catch (err) {
        res.status(500).send("Erreur MongoDB : " + err.message);
    }
});

module.exports = router;
