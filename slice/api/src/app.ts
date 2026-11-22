//this file create the application

import express from "express";
import cors from "cors";
import helmet from "helmet";

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

export default app;
