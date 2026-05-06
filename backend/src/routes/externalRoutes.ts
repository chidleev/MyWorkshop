import { Router } from "express";
import { ExternalController } from "../controllers/ExternalController";
import { apiKeyMiddleware } from "../middlewares/apiKeyMiddleware";

const router = Router();

router.post("/leads", apiKeyMiddleware, ExternalController.createLead);

export default router;
