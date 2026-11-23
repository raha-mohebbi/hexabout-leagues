// This file creates the application

import express from "express";
import cors from "cors";
import helmet from "helmet";
import matchRoutes from "./modules/matches/match.routes.js";
import leaderboardRoutes from "./modules/leaderboard/leaderboard.routes.js";

const app = express();

// Security headers
app.use(helmet());

// Enable cross-origin requests
app.use(cors());

// Parse incoming JSON requests
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: "ok",
    },
    error: null,
  });
});

// Match routes
app.use("/api/v1/matches", matchRoutes);

// Leaderboard routes
app.use("/api/v1/leagues", leaderboardRoutes);

export default app;