import express from "express";
import protect from "../middleware/authMiddleware.js";
const router = express.Router();

import {
  registerUser,
  authUser,
  allUsers,
} from "../controllers/userControllers.js";

router.route("/").get(protect, allUsers);
router.route("/").post(registerUser);
router.route("/login").post(authUser);

export default router;
