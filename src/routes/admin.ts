import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Toutes les routes admin nécessitent auth + rôle ADMIN
router.use(authenticate, requireAdmin);

// ── Gestion des utilisateurs ──────────────────────────────────────────────────

// GET /api/admin/users
router.get("/users", async (_req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: "USER" },
      select: { id: true, firstName: true, lastName: true, email: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, message: "OK", data: users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /api/admin/users/:id/approve
router.put("/users/:id/approve", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "APPROVED" },
    });

    // Créer des entrées UserBet pour tous les paris existants
    const pendingBets = await prisma.bet.findMany({ where: { status: "PENDING" } });
    if (pendingBets.length > 0) {
      await prisma.userBet.createMany({
        data: pendingBets.map((b) => ({ userId: user.id, betId: b.id, followed: false })),
        skipDuplicates: true,
      });
    }

    res.json({ success: true, message: `${user.firstName} ${user.lastName} a été approuvé.` });
  } catch {
    res.status(404).json({ success: false, message: "Utilisateur introuvable." });
  }
});

// PUT /api/admin/users/:id/reject
router.put("/users/:id/reject", async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { status: "REJECTED" },
    });
    res.json({ success: true, message: `${user.firstName} ${user.lastName} a été refusé.` });
  } catch {
    res.status(404).json({ success: false, message: "Utilisateur introuvable." });
  }
});

// ── Gestion des paris ─────────────────────────────────────────────────────────

// GET /api/admin/bets
router.get("/bets", async (_req: AuthRequest, res: Response) => {
  try {
    const bets = await prisma.bet.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { userBets: true } },
        userBets: { select: { followed: true } },
      },
    });

    const data = bets.map((bet) => ({
      id: bet.id,
      sport: bet.sport,
      description: bet.description,
      odds: bet.odds,
      unit: bet.unit,
      status: bet.status,
      createdAt: bet.createdAt,
      totalUsers: bet._count.userBets,
      followers: bet.userBets.filter((ub) => ub.followed).length,
    }));

    res.json({ success: true, message: "OK", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// POST /api/admin/bets
router.post("/bets", async (req: AuthRequest, res: Response) => {
  const { sport, description, odds, unit } = req.body;

  if (!sport?.trim() || !description?.trim() || odds == null) {
    res.status(400).json({ success: false, message: "Sport, description et cote sont requis." });
    return;
  }

  const oddsNum = Number(odds);
  const unitNum = unit != null ? Number(unit) : 1;

  if (isNaN(oddsNum) || oddsNum <= 1) {
    res.status(400).json({ success: false, message: "La cote doit être un nombre supérieur à 1." });
    return;
  }
  if (isNaN(unitNum) || unitNum <= 0) {
    res.status(400).json({ success: false, message: "L'unité doit être un nombre positif (ex: 0.75, 1, 1.5)." });
    return;
  }

  try {
    const bet = await prisma.bet.create({
      data: { sport: sport.trim(), description: description.trim(), odds: oddsNum, unit: unitNum },
    });

    // Créer des entrées UserBet pour tous les membres VIP approuvés
    const approvedUsers = await prisma.user.findMany({
      where: { role: "USER", status: "APPROVED" },
      select: { id: true },
    });

    if (approvedUsers.length > 0) {
      await prisma.userBet.createMany({
        data: approvedUsers.map((u) => ({ userId: u.id, betId: bet.id, followed: false })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, message: "Pari créé avec succès.", data: bet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur lors de la création du pari." });
  }
});

// PUT /api/admin/bets/:id (modifier sport, description, odds, unit)
router.put("/bets/:id", async (req: AuthRequest, res: Response) => {
  const { sport, description, odds, unit } = req.body;

  if (!sport?.trim() || !description?.trim() || odds == null || unit == null) {
    res.status(400).json({ success: false, message: "Tous les champs sont requis." });
    return;
  }

  const oddsNum = Number(odds);
  const unitNum = Number(unit);

  if (isNaN(oddsNum) || oddsNum <= 1) {
    res.status(400).json({ success: false, message: "La cote doit être supérieure à 1." });
    return;
  }
  if (isNaN(unitNum) || unitNum <= 0) {
    res.status(400).json({ success: false, message: "L'unité doit être positive." });
    return;
  }

  try {
    const bet = await prisma.bet.update({
      where: { id: req.params.id },
      data: { sport: sport.trim(), description: description.trim(), odds: oddsNum, unit: unitNum },
    });
    res.json({ success: true, message: "Pari modifié.", data: bet });
  } catch {
    res.status(404).json({ success: false, message: "Pari introuvable." });
  }
});

// PUT /api/admin/bets/:id/result
router.put("/bets/:id/result", async (req: AuthRequest, res: Response) => {
  const { result } = req.body;

  if (!["WON", "LOST"].includes(result)) {
    res.status(400).json({ success: false, message: "Résultat invalide. Utilisez WON ou LOST." });
    return;
  }

  try {
    const bet = await prisma.bet.update({
      where: { id: req.params.id },
      data: { status: result as "WON" | "LOST" },
    });
    res.json({ success: true, message: "Résultat enregistré.", data: bet });
  } catch {
    res.status(404).json({ success: false, message: "Pari introuvable." });
  }
});

// DELETE /api/admin/bets/:id
router.delete("/bets/:id", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.bet.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Pari supprimé." });
  } catch {
    res.status(404).json({ success: false, message: "Pari introuvable." });
  }
});

export default router;
