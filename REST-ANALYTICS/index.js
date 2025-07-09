const express = require("express");
const { MongoClient } = require("mongodb");

const app = express();
const port = 3000;

const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

const viewsRoutes = require("./routes/views");
const actionsRoutes = require("./routes/actions");
const goalsRoutes = require("./routes/goals");

app.use("/views", viewsRoutes);
app.use("/actions", actionsRoutes);
app.use("/goals", goalsRoutes);

client.connect().then(() => {
    db = client.db("analyticsDB");
    app.locals.db = db;

    app.listen(port, () => {
        console.log(`API Analytics running on http://localhost:${port}`);
    });
});
