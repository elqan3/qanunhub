import { webhookCallback } from "grammy";
import type { IncomingMessage, ServerResponse } from "node:http";
import { bot } from "../bot/app.js";

const handleUpdate = webhookCallback(bot, "http");
const canonicalWebhookUrl = "https://qanunhub.vercel.app/api/telegram";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // A browser GET is a health check, not a Telegram update payload.
  if (req.method === "GET") {
    try {
      const me = await bot.api.getMe();
      const before = await bot.api.getWebhookInfo();

      // Repair the common stale/mistyped webhook URL automatically.
      if (before.url !== canonicalWebhookUrl) {
        await bot.api.setWebhook(canonicalWebhookUrl);
      }

      const webhook = await bot.api.getWebhookInfo();
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        ok: true,
        bot: { id: me.id, username: me.username },
        webhook: {
          configured: webhook.url === canonicalWebhookUrl,
          url: webhook.url,
          pending_update_count: webhook.pending_update_count,
          last_error_date: webhook.last_error_date ?? null,
          last_error_message: webhook.last_error_message ?? null,
        },
      }));
      return;
    } catch (error) {
      console.error("Telegram webhook health check failed:", error);
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify({
        ok: false,
        error: "Telegram API check failed. Verify TELEGRAM_BOT_TOKEN in Vercel.",
      }));
      return;
    }
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET, POST");
    res.end("Method Not Allowed");
    return;
  }

  await handleUpdate(req, res);
}
