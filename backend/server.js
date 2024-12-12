// import express from "express";
// import connectDB from "./config/db.js";
// import dotenv from "dotenv";
// import userRoutes from "./routes/userRoutes.js";
// import chatRoutes from "./routes/chatRoutes.js";
// import messageRoutes from "./routes/messageRoutes.js";
// import { notFound, errorHandler } from "./middleware/errorMiddleware.js";

// import { Server } from "socket.io";
// import { createServer } from "http";
// import cors from "cors"; // Import the cors middleware

// // const path = require("path");
// import path from "path";
// dotenv.config();
// connectDB();
// const app = express();
// app.use(cors()); // Apply CORS middleware to all routes
// app.use(express.json()); // to accept json data

// // app.get("/", (req, res) => {
// //   res.send("API Running!");
// // });

// app.use("/api/user", userRoutes);
// app.use("/api/chat", chatRoutes);
// app.use("/api/message", messageRoutes);

// // ----------------DEPLOYMENT-------------------------
// const __dirname1 = path.resolve();
// if (process.env.NODE_ENV === "production") {
//   app.use(express.static(path.join(__dirname1, "/frontend/build")));

//   app.get("*", (req, res) => {
//     res.sendFile(path.resolve(__dirname1, "frontend", "build", "index.html"));
//   });
// } else {
//   app.get("/", (req, res) => {
//     res.send("Api is running successfully");
//   });
// }
// // ---------------------DEPLOYMENT------------------

// // Error Handling middlewares
// app.use(notFound);
// app.use(errorHandler);

// const PORT = process.env.PORT || 5000;

// const server = createServer(app);

// const io = new Server(server, {
//   pingTimeout: 120000,
//   cors: {
//     origin: "http://localhost:3000",
//     // origin: "*",
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });

// io.on("connection", (socket) => {
//   console.log("user connected");
//   console.log("Id", socket.id);
// });

// server.listen(PORT, () => {
//   console.log(`Server running on PORT ${PORT}...`);
// });

// io.on("connection", (socket) => {
//   console.log("User connected");
//   console.log("Id", socket.id);
//   // socket.on("error", (error) => {
//   //   console.error("socket error:", error);
//   // socket.emit("welcome", `welcome to the server, ${socket.id}`);

//   socket.on("setup", (userData) => {
//     socket.join(userData._id);
//     // console.log(userData._id);
//     socket.emit("connected");
//   });

//   socket.on("join chat", (room) => {
//     socket.join(room);
//     console.log("user joined Room " + room);
//   });

//   socket.on("typing", (room) => socket.in(room).emit("typing"));
//   socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

//   socket.on("new message", (newMessageReceived) => {
//     var chat = newMessageReceived.chat;

//     if (!chat.users) return console.log("chat.users not defined");

//     chat.users.forEach((user) => {
//       if (user._id == newMessageReceived.sender._id) return;

//       socket.in(user._id).emit("message received", newMessageReceived);
//     });

//     socket.off("setup", () => {
//       console.log("USER DISCONNECTED");
//       socket.leave(userData._id);
//     });
//   });
// });

// export default io;

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
// wow
