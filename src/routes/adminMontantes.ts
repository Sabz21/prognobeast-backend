import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, requireAdmin, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireAdmin);

// GET /api/admin/montantes
router.get("/", async (_req: AuthRequest, res: Response) => {
  try {
    const montantes = await prisma.montante.findMany({
      orderBy: { number: "asc" },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        _count: { select: { userMontantes: true } },
        userMontantes: { select: { following: true } },
      },
    });

    const data = montantes.map((m) => ({
      id: m.id,
      number: m.number,
      startDate: m.startDate,
      description: m.description,
      status: m.status,
      createdAt: m.createdAt,
      steps: m.steps,
      totalUsers: m._count.userMontantes,
      followers: m.userMontantes.filter((u) => u.following).length,
    }));

    res.json({ success: true, message: "OK", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// POST /api/admin/montantes — créer une montante
router.post("/", async (req: AuthRequest, res: Response) => {
  const { startDate, description } = req.body;

  if (!startDate) {
    res.status(400).json({ success: false, message: "La date de début est requise." });
    return;
  }

  const parsedDate = new Date(startDate);
  if (isNaN(parsedDate.getTime())) {
    res.status(400).json({ success: false, message: "Date invalide." });
    return;
  }

  try {
    // Auto-incrémenter le numéro
    const last = await prisma.montante.findFirst({ orderBy: { number: "desc" } });
    const number = (last?.number ?? 0) + 1;

    const montante = await prisma.montante.create({
      data: { number, startDate: parsedDate, description: description?.trim() || null },
    });

    // Créer entrées UserMontante pour tous les membres approuvés
    const approvedUsers = await prisma.user.findMany({
      where: { role: "USER", status: "APPROVED" },
      select: { id: true },
    });
    if (approvedUsers.length > 0) {
      await prisma.userMontante.createMany({
        data: approvedUsers.map((u) => ({ userId: u.id, montanteId: montante.id })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, message: "Montante créée.", data: montante });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /api/admin/montantes/:id — modifier description/status
router.put("/:id", async (req: AuthRequest, res: Response) => {
  const { description, status, startDate } = req.body;

  try {
    const data: Record<string, unknown> = {};
    if (description !== undefined) data.description = description?.trim() || null;
    if (status !== undefined) data.status = status;
    if (startDate !== undefined) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) data.startDate = d;
    }

    const montante = await prisma.montante.update({ where: { id: req.params.id }, data });
    res.json({ success: true, message: "Montante modifiée.", data: montante });
  } catch {
    res.status(404).json({ success: false, message: "Montante introuvable." });
  }
});

// DELETE /api/admin/montantes/:id
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.montante.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: "Montante supprimée." });
  } catch {
    res.status(404).json({ success: false, message: "Montante introuvable." });
  }
});

// POST /api/admin/montantes/:id/steps — ajouter une étape
router.post("/:id/steps", async (req: AuthRequest, res: Response) => {
  const { sport, description, odds } = req.body;

  if (!sport?.trim() || !description?.trim() || odds == null) {
    res.status(400).json({ success: false, message: "Sport, description et cote sont requis." });
    return;
  }

  const oddsNum = Number(odds);
  if (isNaN(oddsNum) || oddsNum <= 1) {
    res.status(400).json({ success: false, message: "La cote doit être supérieure à 1." });
    return;
  }

  try {
    const lastStep = await prisma.montanteStep.findFirst({
      where: { montanteId: req.params.id },
      orderBy: { stepNumber: "desc" },
    });
    const stepNumber = (lastStep?.stepNumber ?? 0) + 1;

    const step = await prisma.montanteStep.create({
      data: {
        montanteId: req.params.id,
        stepNumber,
        sport: sport.trim(),
        description: description.trim(),
        odds: oddsNum,
      },
    });

    res.status(201).json({ success: true, message: "Étape ajoutée.", data: step });
  } catch {
    res.status(404).json({ success: false, message: "Montante introuvable." });
  }
});

// PUT /api/admin/montantes/:id/steps/:stepId/result — résultat d'une étape
router.put("/:id/steps/:stepId/result", async (req: AuthRequest, res: Response) => {
  const { result } = req.body;

  if (!["WON", "LOST"].includes(result)) {
    res.status(400).json({ success: false, message: "Résultat invalide. Utilisez WON ou LOST." });
    return;
  }

  try {
    const step = await prisma.montanteStep.update({
      where: { id: req.params.stepId },
      data: { status: result },
    });

    // Si LOST → la montante est terminée
    if (result === "LOST") {
      await prisma.montante.update({
        where: { id: req.params.id },
        data: { status: "COMPLETED" },
      });
    }

    res.json({ success: true, message: "Résultat enregistré.", data: step });
  } catch {
    res.status(404).json({ success: false, message: "Étape introuvable." });
  }
});

// DELETE /api/admin/montantes/:id/steps/:stepId
router.delete("/:id/steps/:stepId", async (req: AuthRequest, res: Response) => {
  try {
    await prisma.montanteStep.delete({ where: { id: req.params.stepId } });
    res.json({ success: true, message: "Étape supprimée." });
  } catch {
    res.status(404).json({ success: false, message: "Étape introuvable." });
  }
});

export default router;
