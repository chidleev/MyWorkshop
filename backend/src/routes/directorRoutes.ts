import { Router } from "express";
import { DirectorController } from "../controllers/DirectorController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.use(authMiddleware, requireRole(["Руководитель"]));
router.get("/orders", DirectorController.getOrders);
router.get("/profitability", DirectorController.getProfitability);
router.get("/workload", DirectorController.getWorkload);

export default router;
