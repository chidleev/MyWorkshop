import { Router } from "express";
import { WorkshopController } from "../controllers/WorkshopController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.get("/tasks", authMiddleware, requireRole(["Мастер цеха", "Руководитель"]), WorkshopController.getTasks);
router.get(
  "/deployments",
  authMiddleware,
  requireRole(["Монтажник", "Руководитель", "Менеджер"]),
  WorkshopController.getDeployments
);

export default router;
