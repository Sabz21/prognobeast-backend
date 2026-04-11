import { Router, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { authenticate, requireApproved, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireApproved);

// GET /api/bets — tous les paris avec statut de suivi de l'utilisateur
router.get("/", async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const bets = await prisma.bet.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        userBets: {
          where: { userId },
          select: { id: true, followed: true },
        },
      },
    });

    const data = bets.map((bet) => {
      const userBet = bet.userBets[0];
      const followed = userBet?.followed ?? false;

      let gainLoss: number | null = null;
      if (bet.status !== "PENDING" && followed) {
        gainLoss =
          bet.status === "WON"
            ? parseFloat(((bet.odds - 1) * bet.unit).toFixed(2))
            : parseFloat((-bet.unit).toFixed(2));
      }

      return {
        id: bet.id,
        sport: bet.sport,
        description: bet.description,
        odds: bet.odds,
        unit: bet.unit,
        status: bet.status,
        createdAt: bet.createdAt,
        followed,
        userBetId: userBet?.id ?? null,
        gainLoss,
      };
    });

    res.json({ success: true, message: "OK", data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /api/bets/:id/follow — marquer suivi ou non suivi
router.put("/:id/follow", async (req: AuthRequest, res: Response) => {
  const { followed } = req.body;
  const userId = req.user!.id;
  const betId = req.params.id;

  try {
    const bet = await prisma.bet.findUnique({ where: { id: betId } });
    if (!bet) {
      res.status(404).json({ success: false, message: "Pari introuvable." });
      return;
    }

    if (bet.status !== "PENDING") {
      res.status(400).json({
        success: false,
        message: "Le résultat de ce pari a déjà été enregistré, vous ne pouvez plus modifier votre suivi.",
      });
      return;
    }

    const userBet = await prisma.userBet.upsert({
      where: { userId_betId: { userId, betId } },
      update: { followed: Boolean(followed) },
      create: { userId, betId, followed: Boolean(followed) },
    });

    res.json({ success: true, message: "Prise de position enregistrée.", data: userBet });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

export default router;
