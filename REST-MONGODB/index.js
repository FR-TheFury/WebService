const express = require("express");
const { MongoClient } = require("mongodb");
const http = require("http");
const socketIo = require("socket.io");

const app = express();
const port = 8000;

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // ⚠️ à adapter en prod
        methods: ["GET", "POST", "PUT", "DELETE"]
    }
});

const client = new MongoClient("mongodb://localhost:27017");
let db;

app.use(express.json());

// Routes
const productRoutes = require("./routes/products")(io); // <- passe io aux routes
const categoryRoutes = require("./routes/categories")(io);

app.use("/products", productRoutes);
app.use("/categories", categoryRoutes);

client.connect().then(() => {
    db = client.db("myDB");
    app.locals.db = db;

    server.listen(port, () => {
        console.log(`Listening on http://localhost:${port}`);
    });
});

app.use(express.static("public"));
