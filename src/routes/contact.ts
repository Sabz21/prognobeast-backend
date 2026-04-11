// src/routes/contact.ts
import { Router, Request, Response } from "express";
import { ContactPayload, ApiResponse } from "../types";

const router = Router();

/**
 * POST /api/contact
 * Reçoit le formulaire de contact du front Vercel.
 * Pour l'instant : log + réponse 200.
 * À brancher : Nodemailer, Resend, Telegram Bot API, etc.
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const body = req.body as ContactPayload;

    // ── Validation basique ───────────────────────────────────────────────────
    const { name, email, subject, message } = body;

    if (!name || !email || !message) {
      const response: ApiResponse = {
        success: false,
        message: "Champs obligatoires manquants : name, email, message.",
      };
      res.status(400).json(response);
      return;
    }

    // Validation email simple
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const response: ApiResponse = {
        success: false,
        message: "Adresse email invalide.",
      };
      res.status(400).json(response);
      return;
    }

    // Limite de longueur
    if (message.length > 2000) {
      const response: ApiResponse = {
        success: false,
        message: "Le message ne peut pas dépasser 2000 caractères.",
      };
      res.status(400).json(response);
      return;
    }

    // ── Traitement ───────────────────────────────────────────────────────────
    console.log("📩 Nouveau message de contact:", {
      name,
      email,
      subject: subject || "(aucun sujet)",
      messageLength: message.length,
      timestamp: new Date().toISOString(),
    });

    /**
     * TODO : brancher un service d'envoi d'email
     *
     * Exemple avec Resend (recommandé) :
     *   npm install resend
     *   const { Resend } = await import("resend");
     *   const resend = new Resend(process.env.RESEND_API_KEY);
     *   await resend.emails.send({
     *     from: "contact@prognobeast.com",
     *     to: "admin@prognobeast.com",
     *     subject: `[Contact] ${subject} — ${name}`,
     *     text: `De: ${name} <${email}>\n\n${message}`,
     *   });
     *
     * Exemple avec Telegram Bot API :
     *   const text = `📩 Nouveau contact\nNom: ${name}\nEmail: ${email}\nSujet: ${subject}\n\n${message}`;
     *   await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
     *     method: "POST",
     *     headers: { "Content-Type": "application/json" },
     *     body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text }),
     *   });
     */

    const response: ApiResponse = {
      success: true,
      message: "Message reçu. On vous répond dans les meilleurs délais.",
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("❌ Erreur contact route:", error);
    const response: ApiResponse = {
      success: false,
      message: "Erreur interne. Veuillez réessayer plus tard.",
    };
    res.status(500).json(response);
  }
});

export default router;
