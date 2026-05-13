import { Router } from "express";
import { OrderController, mediaUpload, specificationUpload } from "../controllers/OrderController";
import { authMiddleware } from "../middlewares/authMiddleware";
import { requireRole } from "../middlewares/roleMiddleware";

const router = Router();

router.post("/", authMiddleware, requireRole(["Менеджер", "Руководитель"]), OrderController.createOrder);
router.get(
  "/web-applications",
  authMiddleware,
  requireRole(["Менеджер"]),
  OrderController.listWebApplications
);
router.post(
  "/web-applications/:id/claim",
  authMiddleware,
  requireRole(["Менеджер"]),
  OrderController.claimWebApplication
);
router.post(
  "/web-applications/:id/reject",
  authMiddleware,
  requireRole(["Менеджер"]),
  OrderController.rejectWebApplication
);
router.get("/", authMiddleware, OrderController.listOrders);
router.get(
  "/:id/media",
  authMiddleware,
  requireRole(["Менеджер", "Монтажник", "Руководитель", "Кладовщик", "Закупщик", "Мастер цеха"]),
  OrderController.getMedia
);
router.put("/:id", authMiddleware, requireRole(["Менеджер", "Руководитель"]), OrderController.updateOrder);
router.patch(
  "/:id/pricing-markup",
  authMiddleware,
  requireRole(["Менеджер", "Руководитель"]),
  OrderController.patchPricingMarkup
);
router.delete("/:id", authMiddleware, requireRole(["Менеджер", "Руководитель"]), OrderController.deleteOrder);
router.post(
  "/:id/specification/preview",
  authMiddleware,
  requireRole(["Менеджер", "Руководитель"]),
  OrderController.previewSpecification
);
router.post(
  "/:id/specification/commit",
  authMiddleware,
  requireRole(["Менеджер", "Руководитель"]),
  OrderController.commitSpecification
);
router.post(
  "/:id/specification",
  authMiddleware,
  requireRole(["Менеджер", "Руководитель"]),
  specificationUpload.single("file"),
  OrderController.uploadSpecification
);
router.get(
  "/:id/specification",
  authMiddleware,
  requireRole(["Менеджер", "Руководитель", "Монтажник", "Кладовщик", "Закупщик", "Мастер цеха"]),
  OrderController.getSpecification
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
router.delete(
  "/:id/media/:mediaId",
  authMiddleware,
  requireRole(["Монтажник", "Менеджер", "Руководитель"]),
  OrderController.deleteMedia
);

export default router;
