import { InlineKeyboard, type Context } from "grammy";
import { bot } from "./config/telegram.js";
import { supabase } from "./config/supabase.js";
import { upsertTelegramUser } from "./services/user.service.js";

const adminIds = new Set(
  (process.env.TELEGRAM_ADMIN_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean),
);
const isAdmin = (ctx: Context) => Boolean(ctx.from && adminIds.has(String(ctx.from.id)));

type Step = "select_year" | "select_group" | "select_subject" | "awaiting_subject_name" | "select_category" | "awaiting_file";
type Session = {
  telegram_id: number;
  step: Step;
  semester_id: string | null;
  group_id: string | null;
  subject_id: string | null;
  category_id: string | null;
};

async function saveSession(session: Session) {
  const { error } = await supabase.from("admin_upload_sessions").upsert({ ...session, updated_at: new Date().toISOString() }, { onConflict: "telegram_id" });
  if (error) throw error;
}
async function getSession(id: number): Promise<Session | null> {
  const { data, error } = await supabase.from("admin_upload_sessions").select("*").eq("telegram_id", id).maybeSingle();
  if (error) throw error;
  return data as Session | null;
}
async function clearSession(id: number) {
  const { error } = await supabase.from("admin_upload_sessions").delete().eq("telegram_id", id);
  if (error) throw error;
}
function cancelKeyboard() {
  return new InlineKeyboard().text("إلغاء", "upload:cancel");
}
async function start(ctx: Context) {
  if (!ctx.from) return;
  await saveSession({ telegram_id: ctx.from.id, step: "select_year", semester_id: null, group_id: null, subject_id: null, category_id: null });
  const { data, error } = await supabase.from("semesters").select("id, number, name").eq("is_active", true).order("number");
  if (error) throw error;
  const keyboard = new InlineKeyboard();
  for (const year of data ?? []) keyboard.text(year.name || `السنة ${year.number}`, `upload:year:${year.id}`).row();
  keyboard.text("إلغاء", "upload:cancel");
  await ctx.reply(data?.length ? "🛠 إضافة ملف دراسي\n\nاختر السنة الدراسية:" : "لا توجد سنوات دراسية نشطة.", { reply_markup: keyboard });
}
async function showGroups(ctx: Context, yearId: string) {
  if (!ctx.from) return;
  const { data: year, error: yearError } = await supabase.from("semesters").select("id").eq("id", yearId).eq("is_active", true).maybeSingle();
  if (yearError) throw yearError;
  if (!year) throw new Error("السنة الدراسية غير متاحة.");
  const { data, error } = await supabase.from("student_groups").select("id, name, number").eq("semester_id", yearId).eq("is_active", true).order("number");
  if (error) throw error;
  await saveSession({ telegram_id: ctx.from.id, step: "select_group", semester_id: yearId, group_id: null, subject_id: null, category_id: null });
  const keyboard = new InlineKeyboard();
  for (const group of data ?? []) keyboard.text(group.name || `المجموعة ${group.number}`, `upload:group:${group.id}`).row();
  keyboard.text("🔙 رجوع", "upload:back:years").row().text("إلغاء", "upload:cancel");
  await ctx.editMessageText(data?.length ? "اختر المجموعة المستهدفة:" : "لا توجد مجموعات في هذه السنة بعد.", { reply_markup: keyboard });
}
async function showSubjects(ctx: Context, groupId: string) {
  if (!ctx.from) return;
  const { data: group, error: groupError } = await supabase.from("student_groups").select("id, semester_id").eq("id", groupId).eq("is_active", true).maybeSingle();
  if (groupError) throw groupError;
  if (!group) throw new Error("المجموعة غير متاحة.");
  const { data: mappings, error } = await supabase.from("subject_groups").select("subject_id").eq("group_id", groupId);
  if (error) throw error;
  const ids = [...new Set((mappings ?? []).map((row) => row.subject_id))];
  const { data: subjects, error: subjectsError } = ids.length
    ? await supabase.from("subjects").select("id, name").in("id", ids).eq("semester_id", group.semester_id).eq("is_active", true).order("name")
    : { data: [], error: null };
  if (subjectsError) throw subjectsError;
  await saveSession({ telegram_id: ctx.from.id, step: "select_subject", semester_id: group.semester_id, group_id: groupId, subject_id: null, category_id: null });
  const keyboard = new InlineKeyboard();
  for (const subject of subjects ?? []) keyboard.text(subject.name, `upload:subject:${subject.id}`).row();
  keyboard.text("➕ إنشاء مادة جديدة", "upload:subject:new").row();
  keyboard.text("🔙 رجوع", `upload:year:${group.semester_id}`).row().text("إلغاء", "upload:cancel");
  await ctx.editMessageText("اختر المادة أو أنشئ مادة جديدة لهذه المجموعة:", { reply_markup: keyboard });
}
async function showCategories(ctx: Context, subjectId: string) {
  if (!ctx.from) return;
  const session = await getSession(ctx.from.id);
  if (!session?.group_id || !session.semester_id) throw new Error("انتهت الجلسة. أرسل /addfile للبدء من جديد.");
  const { data: subject, error } = await supabase.from("subjects").select("id, name, semester_id").eq("id", subjectId).eq("semester_id", session.semester_id).eq("is_active", true).maybeSingle();
  if (error) throw error;
  if (!subject) throw new Error("المادة غير متاحة في السنة المختارة.");
  const { error: mappingError } = await supabase.from("subject_groups").upsert({ subject_id: subjectId, group_id: session.group_id }, { onConflict: "subject_id,group_id", ignoreDuplicates: true });
  if (mappingError) throw mappingError;
  const { data: categories, error: categoryError } = await supabase.from("categories").select("id, name, icon").eq("is_active", true).order("name");
  if (categoryError) throw categoryError;
  await saveSession({ ...session, step: "select_category", subject_id: subjectId, category_id: null });
  const keyboard = new InlineKeyboard();
  for (const category of categories ?? []) keyboard.text(`${category.icon ? category.icon + " " : ""}${category.name}`, `upload:category:${category.id}`).row();
  keyboard.text("🔙 رجوع", `upload:group:${session.group_id}`).row().text("إلغاء", "upload:cancel");
  await ctx.editMessageText(`📘 المادة: ${subject.name}\n\nاختر تصنيف الملف:`, { reply_markup: keyboard });
}
async function handleCallback(ctx: Context, data: string) {
  if (!ctx.from) return;
  await ctx.answerCallbackQuery();
  if (data === "upload:cancel") {
    await clearSession(ctx.from.id);
    await ctx.editMessageText("تم إلغاء إضافة الملف.");
  } else if (data === "upload:back:years") {
    await start(ctx);
  } else if (data.startsWith("upload:year:")) {
    await showGroups(ctx, data.slice("upload:year:".length));
  } else if (data.startsWith("upload:group:")) {
    await showSubjects(ctx, data.slice("upload:group:".length));
  } else if (data === "upload:subject:new") {
    const session = await getSession(ctx.from.id);
    if (!session?.group_id) throw new Error("اختر المجموعة أولًا.");
    await saveSession({ ...session, step: "awaiting_subject_name", subject_id: null, category_id: null });
    await ctx.reply("أرسل اسم المادة الجديدة نصيًا، أو /cancel للإلغاء.");
  } else if (data.startsWith("upload:subject:")) {
    await showCategories(ctx, data.slice("upload:subject:".length));
  } else if (data.startsWith("upload:category:")) {
    const session = await getSession(ctx.from.id);
    if (!session?.subject_id) throw new Error("اختر المادة أولًا.");
    const categoryId = data.slice("upload:category:".length);
    const { data: category, error } = await supabase.from("categories").select("id, name").eq("id", categoryId).eq("is_active", true).maybeSingle();
    if (error) throw error;
    if (!category) throw new Error("التصنيف غير متاح.");
    await saveSession({ ...session, step: "awaiting_file", category_id: categoryId });
    await ctx.editMessageText(`📂 التصنيف: ${category.name}\n\nأرسل PDF أو مستندًا أو صورة أو فيديو أو ملفًا صوتيًا.\nيمكنك كتابة العنوان في التعليق والوصف في السطر التالي.\n\nأرسل /cancel للإلغاء.`);
  }
}

async function handleAdminMessage(ctx: Context) {
  if (!ctx.from || !ctx.message) return;
  const message = ctx.message;
  if (message.text === "/addfile" || message.text?.startsWith("/addfile@")) {
    await start(ctx);
    return;
  }
  if (message.text === "/cancel" || message.text?.startsWith("/cancel@")) {
    await clearSession(ctx.from.id);
    await ctx.reply("تم إلغاء العملية.");
    return;
  }
  if (message.text === "/start" || message.text?.startsWith("/start@")) {
    await ctx.reply("حسابك مخوّل لإدارة المحتوى. لإضافة ملف دراسي أرسل /addfile.");
    return;
  }
  const session = await getSession(ctx.from.id);
  if (!session) return;
  if (session.step === "awaiting_subject_name") {
    const name = message.text?.trim();
    if (!name || name.startsWith("/")) {
      await ctx.reply("أرسل اسم المادة كنص، أو /cancel للإلغاء.");
      return;
    }
    if (!session.semester_id || !session.group_id) throw new Error("السنة أو المجموعة غير محددة.");
    const { data: subject, error } = await supabase.from("subjects").insert({ semester_id: session.semester_id, name, is_active: true }).select("id").single();
    if (error) throw error;
    const { error: linkError } = await supabase.from("subject_groups").insert({ subject_id: subject.id, group_id: session.group_id });
    if (linkError) {
      await supabase.from("subjects").delete().eq("id", subject.id);
      throw linkError;
    }
    await saveSession({ ...session, step: "select_category", subject_id: subject.id, category_id: null });
    const { data: categories, error: categoryError } = await supabase.from("categories").select("id, name, icon").eq("is_active", true).order("name");
    if (categoryError) throw categoryError;
    const keyboard = new InlineKeyboard();
    for (const category of categories ?? []) keyboard.text(`${category.icon ? category.icon + " " : ""}${category.name}`, `upload:category:${category.id}`).row();
    keyboard.text("إلغاء", "upload:cancel");
    await ctx.reply(`تم إنشاء المادة «${name}». اختر تصنيف الملف:`, { reply_markup: keyboard });
    return;
  }
  if (session.step !== "awaiting_file") {
    if (message.text && !message.text.startsWith("/")) await ctx.reply("تابع الاختيارات من الأزرار الظاهرة، أو أرسل /cancel للإلغاء.");
    return;
  }

  let fileId: string | undefined;
  let uniqueId: string | undefined;
  let type: "document" | "image" | "video" | "audio" = "document";
  let size: number | undefined;
  let fallbackTitle = "ملف دراسي";
  if ("document" in message && message.document) {
    fileId = message.document.file_id; uniqueId = message.document.file_unique_id; size = message.document.file_size;
    fallbackTitle = message.document.file_name?.replace(/\.[^.]+$/, "") || fallbackTitle;
  } else if ("photo" in message && message.photo?.length) {
    const photo = message.photo[message.photo.length - 1];
    fileId = photo.file_id; uniqueId = photo.file_unique_id; size = photo.file_size; type = "image"; fallbackTitle = "صورة دراسية";
  } else if ("video" in message && message.video) {
    fileId = message.video.file_id; uniqueId = message.video.file_unique_id; size = message.video.file_size; type = "video";
    fallbackTitle = message.video.file_name?.replace(/\.[^.]+$/, "") || "فيديو دراسي";
  } else if ("audio" in message && message.audio) {
    fileId = message.audio.file_id; uniqueId = message.audio.file_unique_id; size = message.audio.file_size; type = "audio";
    fallbackTitle = message.audio.file_name?.replace(/\.[^.]+$/, "") || message.audio.title || "ملف صوتي";
  } else {
    await ctx.reply("لم أجد ملفًا. أرسل مستندًا أو PDF أو صورة أو فيديو أو ملفًا صوتيًا.");
    return;
  }
  if (!fileId || !session.subject_id || !session.category_id) throw new Error("بيانات الإضافة غير مكتملة. أرسل /addfile للبدء مجددًا.");
  const caption = "caption" in message ? message.caption?.trim() : undefined;
  const lines = caption?.split("\n").map((line) => line.trim()).filter(Boolean) ?? [];
  const title = (lines[0] || fallbackTitle).slice(0, 200);
  const description = lines.length > 1 ? lines.slice(1).join("\n").slice(0, 2000) : null;
  const user = await upsertTelegramUser({ telegramId: ctx.from.id, username: ctx.from.username, firstName: ctx.from.first_name, lastName: ctx.from.last_name });
  const { error } = await supabase.from("files").insert({
    subject_id: session.subject_id, category_id: session.category_id, title, description,
    telegram_file_id: fileId, telegram_file_unique_id: uniqueId ?? null, file_type: type,
    file_size: size ?? null, uploader_id: user.id, is_public: true,
  });
  if (error) throw error;
  await clearSession(ctx.from.id);
  await ctx.reply(`✅ تمت إضافة «${title}» بنجاح، وأصبح الملف متاحًا للطلاب.\n\nلإضافة ملف آخر أرسل /addfile.`);
}

// This middleware is registered before the student subscription gate in app.ts.
// It consumes every update from allowlisted admins, so admin tools do not depend on channel membership.
bot.use(async (ctx, next) => {
  if (!isAdmin(ctx)) return next();
  try {
    if (ctx.callbackQuery?.data?.startsWith("upload:")) {
      await handleCallback(ctx, ctx.callbackQuery.data);
      return;
    }
    if (ctx.message) await handleAdminMessage(ctx);
  } catch (error) {
    console.error("Admin upload flow failed:", error);
    const message = error instanceof Error ? error.message : "تعذّر إكمال العملية. حاول مجددًا.";
    if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, message);
  }
});
