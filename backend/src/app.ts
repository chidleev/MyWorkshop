import express from "express";
import cors from "cors";
import orderRoutes from "./routes/orderRoutes";
import externalRoutes from "./routes/externalRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import directorRoutes from "./routes/directorRoutes";
import workshopRoutes from "./routes/workshopRoutes";
import { errorHandler } from "./middlewares/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));
app.use("/documents", express.static("documents"));

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

export default app;
