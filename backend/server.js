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

// Global state tracking
const userSocketMap = new Map(); // userId -> socketId
const chatTypingUsers = new Map(); // chatId -> Set of userIds

// Enhanced allowed origins configuration
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim()).filter(Boolean)
  : [
      "http://localhost:3000", 
      "https://viper-chat.onrender.com",
      "http://viper-chat.onrender.com",
      "https://viper-chat.onrender.com",
      "http://viper-chat.onrender.com"
    ];

// CORS middleware configuration
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Check for subdomains or variations
    const originHost = origin.replace(/https?:\/\//, '');
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      const allowedHost = allowedOrigin.replace(/https?:\/\//, '');
      return originHost === allowedHost || 
             originHost.startsWith(allowedHost);
    });

    if (isAllowed) {
      return callback(null, true);
    }
    
    console.error(`CORS blocked for origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

// Apply CORS middleware

app.options('*', cors()); // Enable preflight for all routes
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

// Enhanced Socket.IO Configuration
const io = new Server(server, {
  cors: {
    origin: allowedOrigins, // Ensure this matches `allowedOrigins`
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 30000,
  pingInterval: 15000,
  transports: ["websocket", "polling"],
  connectionStateRecovery: { // Fixed typo
    maxDisconnectionDuration: 60000,
    skipMiddlewares: true,
  }
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`New connection: ${socket.id} from ${socket.handshake.headers.origin || 'unknown origin'}`);

  // User setup
  socket.on("setup", (userData) => {
    try {
      if (!userData?._id) {
        console.error("Invalid user data in setup");
        return;
      }

      socket.join(userData._id);
      userSocketMap.set(userData._id, socket.id);
      console.log(`User ${userData._id} connected`);
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

  // Typing indicator
  const typingCooldown = new Set();
  socket.on("typing", ({ chatId, userId }) => {
    try {
      if (!chatId || !userId) {
        console.error("Missing chatId or userId in typing event");
        return;
      }

      if (typingCooldown.has(`${userId}:${chatId}`)) return;
      typingCooldown.add(`${userId}:${chatId}`);
      
      setTimeout(() => typingCooldown.delete(`${userId}:${chatId}`), 1000);

      if (!chatTypingUsers.has(chatId)) {
        chatTypingUsers.set(chatId, new Set());
      }

      chatTypingUsers.get(chatId).add(userId);
      socket.to(chatId).emit("typing", userId);
    } catch (error) {
      console.error("Typing handler error:", error);
    }
  });

  // Stop typing
  socket.on("stop typing", ({ chatId, userId }) => {
    try {
      if (!chatId || !userId) {
        console.error("Missing chatId or userId in stop typing event");
        return;
      }

      if (chatTypingUsers.has(chatId)) {
        chatTypingUsers.get(chatId).delete(userId);
        if (chatTypingUsers.get(chatId).size === 0) {
          socket.to(chatId).emit("stop typing");
        }
      }
    } catch (error) {
      console.error("Stop typing handler error:", error);
    }
  });

  // New message
  socket.on("new message", (newMessage, callback) => {
    try {
      const chat = newMessage?.chat;
      if (!chat?.users || !newMessage?.sender?._id) {
        console.error("Invalid message format");
        return callback({ status: "error", error: "Invalid message format" });
      }

      callback({ status: "received" });
      chat.users.forEach(user => {
        if (user._id !== newMessage.sender._id) {
          socket.to(user._id).emit("message received", newMessage);
        }
      });
    } catch (error) {
      console.error("New message handler error:", error);
      callback({ status: "error", error: error.message });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    try {
      console.log(`User disconnected: ${socket.id}`);
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          // Clean up typing indicators
          for (const [chatId, users] of chatTypingUsers.entries()) {
            if (users.has(userId)) {
              users.delete(userId);
              if (users.size === 0) {
                socket.to(chatId).emit("stop typing");
              }
            }
          }
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

// Enhanced health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    connections: io.engine?.clientsCount || 0,
    uptime: process.uptime()
  });
});

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
}).on('error', (error) => {
  console.error("Server error:", error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  io.close(() => {
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
});