import { webhookCallback } from "grammy";
import type { IncomingMessage, ServerResponse } from "node:http";
import { bot } from "../bot/app.js";

const handleUpdate = webhookCallback(bot, "http");

export default function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  return handleUpdate(req, res);
}
