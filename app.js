import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server)

app.use(express.static("static"));

io.on("connection", (socket) =>{
    console.log("socket connected:", socket.id);
});

server.listen(3000, () => console.log("http://localhost:3000"));