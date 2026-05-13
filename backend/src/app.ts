import "dotenv/config";
import express from "express";
import cors, { type CorsOptions } from "cors";
import helmet from "helmet";
import orderRoutes from "./routes/orderRoutes";
import externalRoutes from "./routes/externalRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import directorRoutes from "./routes/directorRoutes";
import workshopRoutes from "./routes/workshopRoutes";
import { checkDbConnection } from "./config/db";
import { documentsPath, ensureRuntimeDirectories, uploadsPath } from "./config/paths";
import { errorHandler } from "./middlewares/errorHandler";
import { AppError } from "./utils/AppError";
import { logStartup } from "./utils/logger";

const app = express();
let processHandlersRegistered = false;
let serverStarted = false;

logStartup("app module loaded", {
  nodeEnv: process.env.NODE_ENV ?? "development",
  cwd: process.cwd(),
});

function normalizeOrigin(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/+$/, "");
  }
}

function parseOriginsCsv(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((part) => normalizeOrigin(part))
    .filter((origin): origin is string => Boolean(origin));
}

const configuredOrigins = new Set<string>([
  ...parseOriginsCsv(process.env.FRONTEND_URLS),
  ...parseOriginsCsv(process.env.FRONTEND_URL),
]);

if (process.env.NODE_ENV !== "production") {
  configuredOrigins.add("http://localhost:5173");
  configuredOrigins.add("http://127.0.0.1:5173");
  configuredOrigins.add("http://localhost:3000");
  configuredOrigins.add("http://127.0.0.1:3000");
}

const allowedFrontendOrigins = [...configuredOrigins];
logStartup("environment loaded", {
  port: process.env.PORT ?? "3000",
  frontendOrigins: allowedFrontendOrigins.length > 0 ? allowedFrontendOrigins.join(", ") : "not configured",
  crmMode: process.env.USE_MOCK_CRM === "true" || !process.env.CRM_API_URL ? "mock" : "external",
});

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedFrontendOrigins.includes(normalizeOrigin(origin) ?? "")) {
      callback(null, true);
      return;
    }

    callback(new AppError(403, "CORS origin is not allowed"));
  },
  credentials: true,
};

logStartup("runtime directory check started", { uploadsPath, documentsPath });
ensureRuntimeDirectories();
logStartup("runtime directory check completed");

app.use(
  helmet({
    // Allow frontend on another origin to load uploaded images/documents.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors(corsOptions));
app.use(express.json());
app.use("/uploads", express.static(uploadsPath));
app.use("/documents", express.static(documentsPath));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/orders", orderRoutes);
app.use("/api/external", externalRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/director", directorRoutes);
app.use("/api/workshop", workshopRoutes);
app.use("/api/installer", workshopRoutes);

app.use(errorHandler);
logStartup("express middleware and routes registered");

export function registerProcessHandlers(): void {
  if (processHandlersRegistered) {
    logStartup("process handlers already registered");
    return;
  }

  processHandlersRegistered = true;
  logStartup("process handlers registered");
  process.on("uncaughtException", (error) => {
    console.error("Uncaught Exception:", error);
  });

  process.on("unhandledRejection", (error) => {
    console.error("Unhandled Rejection:", error);
  });
}

export async function startServer(): Promise<void> {
  if (serverStarted) {
    logStartup("server startup skipped because listener is already starting or started");
    return;
  }

  serverStarted = true;
  const port = Number(process.env.PORT ?? "3000");
  logStartup("server startup started", { port });

  try {
    await checkDbConnection();
  } catch (error) {
    logStartup("database check failed, continuing startup");
    console.error(error);
  }

  logStartup("http listener starting", { port });
  app.listen(port, () => {
    logStartup("http listener started", { port });
  });
}

function shouldAutoStartServer(): boolean {
  return require.main === module || process.env.NODE_ENV === "production" || process.env.START_HTTP_SERVER === "true";
}

if (shouldAutoStartServer()) {
  registerProcessHandlers();
  void startServer();
}

export default app;
