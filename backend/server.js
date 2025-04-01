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
connectDB();

const app = express();
const server = createServer(app);

// Enhanced CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

// API Routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

// ------------------- Deployment Configuration -------------------
const __dirname1 = path.resolve();

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname1, "/frontend/build")));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"));
  });
} else {
  app.get("/", (req, res) => {
    res.send("API is running successfully");
  });
}

// Error Handling Middlewares
app.use(notFound);
app.use(errorHandler);

// Socket.IO Configuration
const io = new Server(server, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
});

// Global state tracking

const chatTypingUsers = new Map(); // chatId -> Set of userIds

io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id}`);

  // User setup - add to user map and join user's room
  socket.on("setup", (userData) => {
    try {
      if (!userData?._id) {
        console.error("Invalid user data in setup");
        return;
      }

      socket.join(userData._id);
      userSocketMap.set(userData._id, socket.id);
      console.log(`User connected: ${userData._id}`);
      socket.emit("connected");
    } catch (error) {
      console.error("Setup error:", error);
    }
  });

  // Join chat room
  socket.on("join chat", (roomId) => {
    try {
      if (!roomId) {
        console.error("Invalid roomId in join chat");
        return;
      }

      socket.join(roomId);
      console.log(`User joined room: ${roomId}`);
    } catch (error) {
      console.error("Join chat error:", error);
    }
  });

  // Handle typing events
  socket.on("typing", ({ chatId, userId }) => {
    try {
      if (!chatId || !userId) {
        console.error("Missing chatId or userId in typing event");
        return;
      }

      // Initialize chat room in typingUsers if not exists
      if (!chatTypingUsers.has(chatId)) {
        chatTypingUsers.set(chatId, new Set());
      }

      // Add user to typing set for this chat
      chatTypingUsers.get(chatId).add(userId);

      // Broadcast to other users in the chat (excluding sender)
      socket.to(chatId).emit("typing", userId);
      console.log(`User ${userId} is typing in chat ${chatId}`);
    } catch (error) {
      console.error("Typing handler error:", error);
    }
  });

  // Handle stop typing events
  socket.on("stop typing", ({ chatId, userId }) => {
    try {
      if (!chatId || !userId) {
        console.error("Missing chatId or userId in stop typing event");
        return;
      }

      if (chatTypingUsers.has(chatId)) {
        // Remove user from typing set
        chatTypingUsers.get(chatId).delete(userId);

       // If no one is typing in this chat, broadcast stop
       if (chatTypingUsers.get(chatId).size === 0) {
        socket.to(chatId).emit("user stopped typing");
      }
    }
  } catch (error) {
    console.error("Stop typing handler error:", error);
  }
});

  // Handle new messages
  socket.on("new message", (newMessage) => {
    try {
      const chat = newMessage?.chat;
      if (!chat?.users) {
        console.error("Invalid message format in new message");
        return;
      }

      // Send to all users in chat except sender
      chat.users.forEach((user) => {
        if (user._id !== newMessage.sender._id) {
          socket.to(user._id).emit("message received", newMessage);
        }
      });
    } catch (error) {
      console.error("New message handler error:", error);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    try {
      console.log(`User disconnected: ${socket.id}`);
      
      // Clean up user from userSocketMap
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          console.log(`Removed user ${userId} from tracking`);
          break;
        }
      }
    } catch (error) {
      console.error("Disconnect handler error:", error);
    }
  });

  // Error handling
  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

// Handle server errors
server.on("error", (error) => {
  console.error("Server error:", error);
});