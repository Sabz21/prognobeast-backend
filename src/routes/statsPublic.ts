import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

// GET /api/stats/vip — bilan public VIP (sans détail des sélections)
router.get("/vip", async (_req: Request, res: Response) => {
  try {
    const bets = await prisma.bet.findMany({
      select: { createdAt: true, status: true, unit: true, odds: true },
      orderBy: { createdAt: "asc" },
    });

    const data = bets.map((b) => {
      let gainLoss: number | null = null;
      if (b.status === "WON") gainLoss = parseFloat((b.unit * (b.odds - 1)).toFixed(2));
      else if (b.status === "LOST") gainLoss = parseFloat((-b.unit).toFixed(2));
      return { createdAt: b.createdAt, status: b.status, gainLoss };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

export default router;
