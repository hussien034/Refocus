import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  ChatHistoryMessage,
  CoachContextPayload,
  generateCoachReply,
  generateWeeklyCoachInsight,
  hasValidGeminiKey,
} from "./server/coachEngine";
import {
  applyUserSyncOperations,
  authenticateUser,
  createUserAccount,
  deleteUserAccountById,
  getUserStateById,
  PersistedUserState,
  resetUserPassword,
  saveUserStateById,
  ServerSyncOperation,
  todayISO,
  verifyAuthToken,
} from "./server/userStore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface AuthedRequest extends Request {
  userId?: string;
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }
  const userId = verifyAuthToken(token);
  if (!userId) {
    return res.status(401).json({ error: "Invalid or expired session." });
  }
  req.userId = userId;
  next();
}

async function createServer() {
  const app = express();
  const allowedOrigins = new Set(
    (process.env.CORS_ORIGIN || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  );
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:3000");
    allowedOrigins.add("http://localhost:5173");
    allowedOrigins.add("http://127.0.0.1:3000");
    allowedOrigins.add("http://127.0.0.1:5173");
  }
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("Origin");
    if (!origin) {
      if (req.method === "OPTIONS") return res.sendStatus(204);
      return next();
    }
    if (!allowedOrigins.has(origin)) {
      return res.status(403).json({ error: "This app origin is not allowed." });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      geminiConfigured: hasValidGeminiKey(),
      storage: "json-file",
      timestamp: new Date().toISOString(),
    });
  });

  // --- Real Authentication & Per-User JSON Storage Routes ---
  app.post("/api/auth/signup", (req: Request, res: Response) => {
    const { name, email, password, language = "en" } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      language?: "en" | "ar";
    };

    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({
        error:
          language === "ar"
            ? "يرجى إدخال الاسم والبريد الإلكتروني وكلمة مرور من 6 أحرف على الأقل."
            : "Name, valid email, and password (min 6 characters) are required.",
      });
    }

    const result = createUserAccount({
      name: name.trim(),
      email: email.trim(),
      password,
      language: language === "ar" ? "ar" : "en",
    });

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.status(201).json({
      token: result.token,
      state: result.user.state,
    });
  });

  app.post("/api/auth/login", (req: Request, res: Response) => {
    const { email, password, language = "en" } = req.body as {
      email?: string;
      password?: string;
      language?: "en" | "ar";
    };

    if (!email?.trim() || !password) {
      return res.status(400).json({
        error:
          language === "ar"
            ? "يرجى إدخال البريد الإلكتروني وكلمة المرور."
            : "Email and password are required.",
      });
    }

    const result = authenticateUser({
      email: email.trim(),
      password,
      language: language === "ar" ? "ar" : "en",
    });

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    const today = todayISO();
    const state = result.user.state;
    const syncedState: PersistedUserState = {
      ...state,
      aiMessagesUsedToday: state.aiQuotaDate === today ? state.aiMessagesUsedToday : 0,
      aiQuotaDate: today,
    };

    return res.json({
      token: result.token,
      state: syncedState,
    });
  });

  app.post("/api/auth/reset-password", (req: Request, res: Response) => {
    const { email, newPassword, language = "en" } = req.body as {
      email?: string;
      newPassword?: string;
      language?: "en" | "ar";
    };

    if (!email?.trim() || !newPassword || newPassword.length < 6) {
      return res.status(400).json({
        error:
          language === "ar"
            ? "يرجى إدخال البريد الإلكتروني وكلمة مرور جديدة من 6 أحرف على الأقل."
            : "Valid email and new password (min 6 characters) are required.",
      });
    }

    const result = resetUserPassword({
      email: email.trim(),
      newPassword,
      language: language === "ar" ? "ar" : "en",
    });

    if ("error" in result) {
      return res.status(result.status).json({ error: result.error });
    }

    return res.json({ ok: true });
  });

  app.get("/api/user/state", requireAuth, (req: AuthedRequest, res: Response) => {
    const state = getUserStateById(req.userId!);
    if (!state) {
      return res.status(404).json({ error: "User account not found." });
    }
    return res.json({ state });
  });

  app.put("/api/user/state", requireAuth, (req: AuthedRequest, res: Response) => {
    const { state } = req.body as { state?: PersistedUserState };
    if (!state || typeof state !== "object" || !state.user) {
      return res.status(400).json({ error: "Invalid state payload." });
    }
    const saved = saveUserStateById(req.userId!, state);
    if (!saved) {
      return res.status(404).json({ error: "User account not found." });
    }
    return res.json({ state: saved });
  });

  app.post("/api/user/sync", requireAuth, (req: AuthedRequest, res: Response) => {
    const { operations } = req.body as { operations?: ServerSyncOperation[] };
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: "Operations array is required." });
    }

    // Security rule: derive ownership strictly from authenticated session token,
    // and reject any operation claiming a different userId.
    const crossUserOp = operations.find((op) => op.userId && op.userId !== req.userId);
    if (crossUserOp) {
      return res.status(403).json({ error: "Cross-user synchronization is forbidden." });
    }

    const result = applyUserSyncOperations(req.userId!, operations);
    if (!result) {
      return res.status(404).json({ error: "User account not found." });
    }
    return res.json(result);
  });

  app.delete("/api/user/account", requireAuth, (req: AuthedRequest, res: Response) => {
    const deleted = deleteUserAccountById(req.userId!);
    if (!deleted) {
      return res.status(404).json({ error: "User account not found." });
    }
    return res.json({ ok: true });
  });

  // --- Server-Side Gemini AI Coach (English & Arabic) ---
  app.post("/api/coach", async (req: Request, res: Response) => {
    if (!hasValidGeminiKey()) {
      return res.status(503).json({
        error: "AI Coach is not configured. Set GEMINI_API_KEY on the backend.",
      });
    }
    try {
      const { message, history = [], context } = req.body as {
        message: string;
        history?: ChatHistoryMessage[];
        context: CoachContextPayload;
      };

      if (!message || typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Message is required." });
      }

      const result = await generateCoachReply({
        message: message.trim(),
        history,
        context,
      });

      return res.json(result);
    } catch (err) {
      console.error("[/api/coach] Error:", err);
      return res.status(500).json({
        error: "Unable to reach the AI Coach right now. Please try again shortly.",
      });
    }
  });

  app.post("/api/coach/weekly-insight", async (req: Request, res: Response) => {
    if (!hasValidGeminiKey()) {
      return res.status(503).json({
        error: "AI Coach is not configured. Set GEMINI_API_KEY on the backend.",
      });
    }
    try {
      const { context } = req.body as { context: CoachContextPayload };
      if (!context) {
        return res.status(400).json({ error: "Context is required." });
      }

      const result = await generateWeeklyCoachInsight(context);
      return res.json(result);
    } catch (err) {
      console.error("[/api/coach/weekly-insight] Error:", err);
      return res.status(500).json({ error: "Could not generate weekly report." });
    }
  });

  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: { server: httpServer },
        ws: { server: httpServer },
        hmr: process.env.DISABLE_HMR === "true" ? false : { server: httpServer },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("/{*path}", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`ReFocus server running on http://localhost:${PORT}`);
  });
}

createServer();
