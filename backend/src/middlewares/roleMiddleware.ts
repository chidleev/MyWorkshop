import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role || !allowedRoles.includes(role)) {
      next(new AppError(403, "Нет доступа"));
      return;
    }
    next();
  };
}
