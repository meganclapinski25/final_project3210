// app.js
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);

const socketio = require('socket.io');
const path = require('path');
// Socket.io
const { Server } = require('socket.io');
const io = new Server(server);

app.use(express.static("static"));

let onlineUsers = {};
io.on("connection", (socket) =>{
    console.log("socket connected:", socket.id);
});

server.listen(3000, () => console.log("http://localhost:3000"));