import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register
router.post("/register", async (req: Request, res: Response) => {
  const { firstName, lastName, email, password } = req.body;

  if (!firstName?.trim() || !lastName?.trim() || !email?.trim() || !password) {
    res.status(400).json({ success: false, message: "Tous les champs sont requis." });
    return;
  }
  if (!EMAIL_RE.test(email)) {
    res.status(400).json({ success: false, message: "Adresse email invalide." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ success: false, message: "Le mot de passe doit contenir au moins 8 caractères." });
    return;
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      res.status(409).json({ success: false, message: "Cette adresse email est déjà utilisée." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase(),
        passwordHash,
      },
    });

    res.status(201).json({
      success: true,
      message:
        "Compte créé avec succès. Votre demande est en cours d'examen — vous serez notifié lorsque votre accès VIP sera activé.",
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, message: "Erreur lors de la création du compte." });
  }
});

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ success: false, message: "Email et mot de passe requis." });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      res.status(401).json({ success: false, message: "Identifiants incorrects." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, message: "Identifiants incorrects." });
      return;
    }

    if (user.role !== "ADMIN" && user.status === "PENDING") {
      res.status(403).json({
        success: false,
        message: "Votre compte est en attente d'approbation par l'administrateur.",
      });
      return;
    }

    if (user.role !== "ADMIN" && user.status === "REJECTED") {
      res.status(403).json({ success: false, message: "Votre demande d'accès a été refusée." });
      return;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, status: user.status },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "Connexion réussie.",
      data: {
        token,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Erreur lors de la connexion." });
  }
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true },
    });

    if (!user) {
      res.status(404).json({ success: false, message: "Utilisateur introuvable." });
      return;
    }

    res.json({ success: true, message: "OK", data: user });
  } catch (err) {
    console.error("Me error:", err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

export default router;
