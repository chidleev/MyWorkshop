import type { NextFunction, Request, Response } from "express";
import { CrmAdapter } from "../services/CrmAdapter";
import { AppError } from "../utils/AppError";

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    next(new AppError(401, "Токен не предоставлен"));
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();
  try {
    req.user = await CrmAdapter.verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
