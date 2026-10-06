import { Bot } from "grammy";
import "dotenv/config";

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

export const bot = new Bot(token);