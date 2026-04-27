import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, requireApproved, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireApproved);

// GET /api/montantes — toutes les montantes avec étapes + participation utilisateur
router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const montantes = await prisma.montante.findMany({
      orderBy: { number: "asc" },
      include: {
        steps: { orderBy: { stepNumber: "asc" } },
        userMontantes: { where: { userId }, select: { following: true, initialStake: true, stepOdds: true } },
        _count: { select: { userMontantes: true } },
      },
    });

    const data = montantes.map((m) => {
      const userM = m.userMontantes[0];
      const wonSteps = m.steps.filter((s) => s.status === "WON").length;
      const lostSteps = m.steps.filter((s) => s.status === "LOST").length;
      const pendingSteps = m.steps.filter((s) => s.status === "PENDING").length;

      return {
        id: m.id,
        number: m.number,
        startDate: m.startDate,
        description: m.description,
        status: m.status,
        createdAt: m.createdAt,
        steps: m.steps,
        following: userM?.following ?? false,
        initialStake: userM?.initialStake ?? null,
        stepOdds: (userM?.stepOdds as Record<string, number> | null) ?? null,
        totalFollowers: m._count.userMontantes,
        wonSteps,
        lostSteps,
        pendingSteps,
      };
    });

    res.json({ success: true, message: "OK", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /api/montantes/:id/participate — rejoindre / modifier participation
router.put("/:id/participate", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const montanteId = req.params.id;
  const { following, initialStake, stepOdds } = req.body;

  try {
    const montante = await prisma.montante.findUnique({ where: { id: montanteId } });
    if (!montante) {
      res.status(404).json({ success: false, message: "Montante introuvable." });
      return;
    }

    const userMontante = await prisma.userMontante.upsert({
      where: { userId_montanteId: { userId, montanteId } },
      update: {
        following: Boolean(following),
        initialStake: initialStake != null ? Number(initialStake) : undefined,
        ...(stepOdds !== undefined && { stepOdds }),
      },
      create: {
        userId,
        montanteId,
        following: Boolean(following),
        initialStake: initialStake != null ? Number(initialStake) : null,
        stepOdds: stepOdds ?? null,
      },
    });

    res.json({ success: true, message: "Participation enregistrée.", data: userMontante });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

export default router;
