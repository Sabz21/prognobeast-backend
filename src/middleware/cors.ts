// src/middleware/cors.ts
import cors from "cors";

const allowedOrigins = [
  process.env.ALLOWED_ORIGIN || "http://localhost:3000",
  "http://localhost:3000",
  "http://localhost:3001",
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin non autorisée: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
