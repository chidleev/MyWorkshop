import { Router } from "express";
import { OrderController, mediaUpload, specificationUpload } from "../controllers/OrderController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.post("/", authMiddleware, requireRole(["Менеджер", "Руководитель"]), OrderController.createOrder);
router.get("/", authMiddleware, OrderController.listOrders);
router.get(
  "/:id/media",
  authMiddleware,
  requireRole(["Менеджер", "Монтажник", "Руководитель", "Кладовщик", "Закупщик", "Мастер цеха"]),
  OrderController.getMedia
);
router.put("/:id", authMiddleware, requireRole(["Менеджер", "Руководитель"]), OrderController.updateOrder);
router.delete("/:id", authMiddleware, requireRole(["Менеджер", "Руководитель"]), OrderController.deleteOrder);
router.post(
  "/:id/specification",
  authMiddleware,
  requireRole(["Менеджер", "Руководитель"]),
  specificationUpload.single("file"),
  OrderController.uploadSpecification
);
router.patch(
  "/:id/status",
  authMiddleware,
  requireRole(["Мастер цеха", "Менеджер", "Руководитель", "Монтажник"]),
  OrderController.patchStatus
);
router.post(
  "/:id/media",
  authMiddleware,
  requireRole(["Монтажник", "Менеджер", "Руководитель"]),
  mediaUpload.single("file"),
  OrderController.uploadMedia
);

export default router;
