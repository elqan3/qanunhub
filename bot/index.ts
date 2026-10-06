import { bot } from "./app.js";

async function main() {
  console.log("QanunHub Bot local runner is starting...");
  await bot.start();
}

main().catch((error: unknown) => {
  console.error("Failed to start bot:", error);
  process.exit(1);
});
