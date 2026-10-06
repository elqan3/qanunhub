import { Bot, type Context } from "grammy";
import { bot } from "./config/telegram.js";
import { upsertTelegramUser } from "./services/user.service.js";

bot.command("start", async (ctx: Context) => {
  try {
    const telegramUser = ctx.from;

    if (!telegramUser) {
      await ctx.reply("تعذر التعرف على حساب Telegram.");
      return;
    }

    const user = await upsertTelegramUser({
      telegramId: telegramUser.id,
      username: telegramUser.username,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name,
    });

    console.log("User registered:", {
      id: user.id,
      telegramId: user.telegram_id,
      username: user.username,
    });

    await ctx.reply(
      "⚖️ أهلاً بك في QanunHub\n\n" +
        "منصة كلية القانون — جامعة الزيتونة\n\n" +
        "اختر من القائمة للبدء.",
    );
  } catch (error) {
    console.error("Start command error:", error);

    await ctx.reply(
      "حدث خطأ أثناء تسجيل حسابك. حاول مرة أخرى.",
    );
  }
});

bot.catch((error) => {
  console.error("Bot error:", error.error);
});

async function main() {
  console.log("QanunHub Bot is starting...");
  await bot.start();
}

main().catch((error: unknown) => {
  console.error("Failed to start bot:", error);
  process.exit(1);
});