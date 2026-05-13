import { Router } from "express";
import { ExternalController } from "../controllers/ExternalController";

const router = Router();

router.post("/leads", ExternalController.createLead);

export default router;
