const express = require("express");
const path = require("path");
const { createServer } = require("http");
const { Server } = require("socket.io");

const app = express();
const server = createServer(app);
const io = new Server(server);

// Serve ./static at /
app.use(express.static(path.join(__dirname, "static")));


io.on("connection", (socket) =>{
    socket.emit("state:init", {stats});


    socket.on("stats:increment", (key))
})