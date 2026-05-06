import dotenv from "dotenv";
import app from "./app";
import { checkDbConnection } from "./config/db";

dotenv.config();

const port = Number(process.env.PORT ?? "3000");

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Unhandled Rejection:", error);
});

async function bootstrap(): Promise<void> {
  try {
    await checkDbConnection();
  } catch (error) {
    console.error("Database connection failed:", error);
  }

  app.listen(port, () => {
    console.log(`Server started on port ${port}`);
  });
}

void bootstrap();
