import { supabase } from "../config/supabase.js";

export interface TelegramUser {
  telegramId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
}

export async function upsertTelegramUser(
  telegramUser: TelegramUser,
) {
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        telegram_id: telegramUser.telegramId,
        username: telegramUser.username ?? null,
        first_name: telegramUser.firstName ?? null,
        last_name: telegramUser.lastName ?? null,
        last_seen_at: new Date().toISOString(),
      },
      {
        onConflict: "telegram_id",
      },
    )
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to upsert Telegram user: ${error.message}`);
  }

  return data;
}