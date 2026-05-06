import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError";

export function apiKeyMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const apiKey = req.header("X-API-KEY");
  if (!apiKey || apiKey !== process.env.EXTERNAL_API_KEY) {
    next(new AppError(401, "Unauthorized"));
    return;
  }
  next();
}
