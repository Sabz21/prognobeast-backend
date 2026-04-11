import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ success: false, message: "Non authentifié." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest["user"];
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, message: "Token invalide ou expiré." });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ success: false, message: "Accès refusé." });
    return;
  }
  next();
}

export function requireApproved(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.user?.status !== "APPROVED") {
    res.status(403).json({ success: false, message: "Votre compte est en attente d'approbation." });
    return;
  }
  next();
}
