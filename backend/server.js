import express from "express";
import connectDB from "./config/db.js";
import dotenv from "dotenv";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import path from "path";

dotenv.config();

// Connect to Database
connectDB();

// Initialize Express App
const app = express();
app.use(cors()); // Apply CORS middleware to all routes
app.use(express.json()); // To accept JSON data

// API Routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// ----------------DEPLOYMENT-------------------------
const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  // Serve static files from React frontend in production
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  // Serve the index.html file for any unknown routes
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("API is running successfully");
  });
}
// ---------------------DEPLOYMENT------------------

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Define Port
const PORT = process.env.PORT || 5000;

// Create HTTP Server
const server = createServer(app);

// Initialize Socket.IO ok
const io = new Server(server, {
  pingTimeout: 120000,
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000", // Use FRONTEND_URL from environment variables
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Socket.IO Events
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");
  });

  socket.on("join chat", (room) => {
    socket.join(room);
    console.log("User joined room:", room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageReceived) => {
    const chat = newMessageReceived.chat;

    if (!chat?.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;
      socket.in(user._id).emit("message received", newMessageReceived);
    });
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV} mode on PORT ${PORT}...`
  );
});
