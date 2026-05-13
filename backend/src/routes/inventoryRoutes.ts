import { Router } from "express";
import { InventoryController } from "../controllers/InventoryController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.post(
    "/materials",
    authMiddleware,
    requireRole(["Менеджер", "Руководитель", "Закупщик"]),
    InventoryController.createMaterial
);
router.get("/", authMiddleware, requireRole(["Кладовщик", "Закупщик", "Руководитель", "Менеджер"]), InventoryController.getInventory);
router.post(
  "/incoming",
  authMiddleware,
  requireRole(["Кладовщик", "Закупщик", "Руководитель"]),
  InventoryController.incomingStock
);
router.get("/deficit", authMiddleware, requireRole(["Закупщик", "Руководитель"]), InventoryController.getDeficit);
router.get("/transactions", authMiddleware, requireRole(["Кладовщик", "Руководитель"]), InventoryController.getTransactions);

export default router;
