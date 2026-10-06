import { webhookCallback } from "grammy";
import { bot } from "../bot/app.js";

const handleUpdate = webhookCallback(bot, "http");

export default async function handler(req: Request): Promise<Response> {
  return handleUpdate(req);
}
