import type { Request, Response } from "express";
import type { ResultSetHeader } from "mysql2";
import { z } from "zod";
import { dbPool } from "../config/db";
import { INV_TX, physicalStockExpression, reservedSumExpression } from "../constants/inventoryTransactions";
import { AppError } from "../utils/AppError";

const createMaterialSchema = z.object({
  article: z.string().trim().min(1),
  name: z.string().trim().min(1),
  base_cost: z.coerce.number().positive()
});

export class InventoryController {
    static async createMaterial(req: Request, res: Response): Promise<void> {
        const parsed = createMaterialSchema.safeParse(req.body);
        if (!parsed.success) {
            throw new AppError(400, "Ошибка валидации");
        }
        const { article, name, base_cost } = parsed.data;

        try {
            const [result] = await dbPool.query<ResultSetHeader>(
                "INSERT INTO materials (article, name, base_cost) VALUES (?, ?, ?)",
                [article, name, Number(base_cost.toFixed(2))]
            );
            res.status(201).json({
                status: "success",
                data: { id: result.insertId, article, name, base_cost: Number(base_cost.toFixed(2)) }
            });
        } catch (error) {
            const nodeError = error as NodeJS.ErrnoException & { code?: string };
            if (nodeError.code === "ER_DUP_ENTRY") {
                throw new AppError(409, "Позиция с таким артикулом уже существует");
            }
            throw error;
        }
    }

    static async getInventory(req: Request, res: Response): Promise<void> {
        const search = String(req.query.search ?? "").trim();
        const hasSearch = search.length > 0;
        const physical = physicalStockExpression("m");
        const reserved = reservedSumExpression("m");
        const [rows] = await dbPool.query(
            `SELECT id, article, name, base_cost,
              ${physical} AS physical_stock,
              ${reserved} AS reserved_change
       FROM materials m
       ${hasSearch ? "WHERE article LIKE ? OR name LIKE ?" : ""}
       ORDER BY name ASC`,
            hasSearch ? [`%${search}%`, `%${search}%`] : [],
        );
        res.json({ status: "success", data: rows });
    }

    static async incomingStock(req: Request, res: Response): Promise<void> {
        const materialId = Number(req.body.material_id);
        const quantity = Number(req.body.quantity);
        if (!Number.isFinite(materialId) || materialId <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
            throw new AppError(400, "Некорректные данные прихода");
        }

        const connection = await dbPool.getConnection();
        try {
            await connection.beginTransaction();
            await connection.query(
                "UPDATE materials SET stock_snapshot = stock_snapshot + ?, stock_snapshot_at = CURRENT_TIMESTAMP(3) WHERE id = ?",
                [quantity, materialId],
            );
            await connection.query(
                `INSERT INTO inventory_transactions (material_id, order_id, tx_type, quantity_change) VALUES (?, NULL, ?, ?)`,
                [materialId, INV_TX.INCOMING, quantity],
            );
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        res.json({ status: "success" });
    }

    static async getDeficit(req: Request, res: Response): Promise<void> {
        const raw = String(req.query.include_reserves ?? "").toLowerCase();
        const includeReserves = raw === "1" || raw === "true" || raw === "yes";

        const physical = physicalStockExpression("m");
        const reserved = reservedSumExpression("m");
        const effective = `(${physical} + ${reserved})`;
        const stockForShortage = includeReserves ? effective : physical;

        const [rows] = await dbPool.query(
            `SELECT id, article, name, base_cost,
              ${physical} AS physical_stock,
              ${reserved} AS reserved_change,
              ${effective} AS effective_stock,
              ABS(${stockForShortage}) AS suggested_qty,
              ABS(${stockForShortage}) * base_cost AS total_deficit_cost
       FROM materials m
       WHERE (${stockForShortage}) <= 0
       ORDER BY ${stockForShortage} ASC`,
        );
        const total_budget = (rows as Array<{ total_deficit_cost: string | number }>).reduce(
            (sum, row) => sum + Number(row.total_deficit_cost),
            0,
        );
        res.json({ status: "success", data: rows, total_budget });
    }

    static async getTransactions(req: Request, res: Response): Promise<void> {
        const txType = req.query.tx_type;
        const orderId = req.query.order_id;
        const limit = Number(req.query.limit ?? 200);
        const offset = Number(req.query.offset ?? 0);
        const where: string[] = [];
        const values: unknown[] = [];
        if (txType) {
            where.push("t.tx_type = ?");
            values.push(txType);
        }
        if (orderId) {
            where.push("t.order_id = ?");
            values.push(orderId);
        }

        const query = `
      SELECT t.id, t.tx_date, t.tx_type, t.quantity_change, t.order_id, m.article, m.name
      FROM inventory_transactions t
      JOIN materials m ON t.material_id = m.id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY t.tx_date DESC
      LIMIT ? OFFSET ?
    `;
        values.push(limit, offset);
        const [rows] = await dbPool.query(query, values);
        res.json({ status: "success", data: rows });
    }
}
