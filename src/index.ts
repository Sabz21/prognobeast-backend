// src/index.ts — PrognoBeast Backend (Railway)
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import { corsMiddleware } from "./middleware/cors";
import contactRouter from "./routes/contact";
import authRouter from "./routes/auth";
import adminRouter from "./routes/admin";
import betsRouter from "./routes/bets";

const app = express();
const PORT = parseInt(process.env.PORT || "4000", 10);

// ── Middleware globaux ────────────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// ── Security headers basiques ─────────────────────────────────────────────────
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// ── Logging minimal ───────────────────────────────────────────────────────────
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Health check (Railway le surveille) ──────────────────────────────────────
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "prognobeast-api",
    timestamp: new Date().toISOString(),
  });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/contact", contactRouter);
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/bets", betsRouter);

// 404 catch-all
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route introuvable." });
});

// Error handler global
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("❌ Unhandled error:", err.message);
  res.status(500).json({ success: false, message: "Erreur interne du serveur." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
  ██████╗ ██████╗  ██████╗  ██████╗ ███╗   ██╗ ██████╗
  ██╔══██╗██╔══██╗██╔═══██╗██╔════╝ ████╗  ██║██╔═══██╗
  ██████╔╝██████╔╝██║   ██║██║  ███╗██╔██╗ ██║██║   ██║
  ██╔═══╝ ██╔══██╗██║   ██║██║   ██║██║╚██╗██║██║   ██║
  ██║     ██║  ██║╚██████╔╝╚██████╔╝██║ ╚████║╚██████╔╝
  ╚═╝     ╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝

  🚀 Backend running on port ${PORT}
  🌍 Allowed origin: ${process.env.ALLOWED_ORIGIN || "http://localhost:3000"}
  📋 Endpoints:
     GET  /health
     POST /api/contact
     POST /api/auth/register
     POST /api/auth/login
     GET  /api/auth/me
     GET  /api/admin/users
     PUT  /api/admin/users/:id/approve
     PUT  /api/admin/users/:id/reject
     GET  /api/admin/bets
     POST /api/admin/bets
     PUT  /api/admin/bets/:id/result
     DEL  /api/admin/bets/:id
     GET  /api/bets
     PUT  /api/bets/:id/follow
  `);
});

export default app;
