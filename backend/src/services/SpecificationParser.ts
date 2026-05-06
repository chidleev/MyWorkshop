import { Readable } from "stream";
import csvParser from "csv-parser";
import { AppError } from "../utils/AppError";
import type { ParsedSpecificationItem } from "../types/auth";

export async function parseSpecificationCsv(file: Express.Multer.File | undefined): Promise<ParsedSpecificationItem[]> {
  if (!file) {
    throw new AppError(400, "Файл не найден");
  }

  if (!file.mimetype.includes("csv") && !file.originalname.toLowerCase().endsWith(".csv")) {
    throw new AppError(400, "Некорректный формат файла");
  }

  const rows: ParsedSpecificationItem[] = [];

  await new Promise<void>((resolve, reject) => {
    let headersValidated = false;
    const parser = csvParser({ separator: "," });
    parser.on("headers", (headers: string[]) => {
      if (!headers.includes("Артикул") || !headers.includes("Количество")) {
        reject(new AppError(400, "CSV должен содержать колонки Артикул и Количество"));
        return;
      }
      headersValidated = true;
    });

    parser.on("data", (row: Record<string, string>) => {
      const article = (row["Артикул"] ?? "").trim();
      const quantityRaw = (row["Количество"] ?? "").trim();
      const quantity = Number(quantityRaw);
      if (!article || !Number.isFinite(quantity) || quantity <= 0) {
        reject(new AppError(400, "Некорректные данные в колонках Артикул/Количество"));
        return;
      }
      rows.push({ article, quantity });
    });

    parser.on("end", () => {
      if (!headersValidated) {
        reject(new AppError(400, "Пустой или поврежденный CSV"));
        return;
      }
      resolve();
    });
    parser.on("error", () => reject(new AppError(400, "Ошибка парсинга CSV")));

    Readable.from(file.buffer).pipe(parser);
  });

  return rows;
}
