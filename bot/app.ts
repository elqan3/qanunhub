import { InlineKeyboard, type Context } from "grammy";
import { bot } from "./config/telegram.js";
import { supabase } from "./config/supabase.js";
import { upsertTelegramUser } from "./services/user.service.js";

const channelId = process.env.STUDENT_UNION_CHANNEL_ID;
const channelUrl = process.env.STUDENT_UNION_CHANNEL_URL;

async function promptSubscription(ctx: Context) {
  const keyboard = new InlineKeyboard();
  if (channelUrl) keyboard.url("📢 الاشتراك في قناة اتحاد الطلبة", channelUrl).row();
  keyboard.text("✅ تحقّق من الاشتراك", "subscription:check");

  const message = "🔒 لاستخدام QanunHub، اشترك أولًا في قناة اتحاد طلبة كلية القانون، ثم اضغط «تحقّق من الاشتراك».";
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery({ text: "الاشتراك في قناة اتحاد الطلبة مطلوب.", show_alert: true }).catch(() => undefined);
    if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, message, { reply_markup: keyboard });
  } else if (ctx.chat) {
    await ctx.api.sendMessage(ctx.chat.id, message, { reply_markup: keyboard });
  }
}

bot.use(async (ctx, next) => {
  if (!ctx.from) return;
  if (!channelId || !channelUrl) {
    if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, "إعداد الاشتراك غير مكتمل. يرجى المحاولة لاحقًا.");
    return;
  }

  try {
    const member = await ctx.api.getChatMember(channelId, ctx.from.id);
    const subscribed =
      member.status === "creator" ||
      member.status === "administrator" ||
      member.status === "member" ||
      (member.status === "restricted" && member.is_member);

    if (!subscribed) {
      await promptSubscription(ctx);
      return;
    }
  } catch (error) {
    console.error("Channel membership verification failed:", error);
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: "تعذّر التحقق من الاشتراك. حاول مجددًا.", show_alert: true }).catch(() => undefined);
    } else if (ctx.chat) {
      await ctx.api.sendMessage(ctx.chat.id, "تعذّر التحقق من الاشتراك حاليًا. حاول مجددًا بعد قليل.");
    }
    return;
  }

  await next();
});

async function showHome(ctx: Context) {
  const keyboard = new InlineKeyboard().text("📚 تصفّح المواد والملفات", "menu:subjects");
  const message = "🎓 QanunHub | قانون هَب\nكلية القانون — جامعة الزيتونة\n\nاختر السنة الدراسية ثم المجموعة، وبعدها الأستاذ أو المادة للوصول إلى المقرر وأسئلة السنوات والملفات المتاحة.";
  if (ctx.callbackQuery) await ctx.editMessageText(message, { reply_markup: keyboard });
  else await ctx.reply(message, { reply_markup: keyboard });
}

async function showYears(ctx: Context) {
  const { data, error } = await supabase.from("semesters").select("id, number, name").eq("is_active", true).order("number");
  if (error) throw error;
  const keyboard = new InlineKeyboard();
  for (const year of data ?? []) keyboard.text(year.name || `السنة ${year.number}`, `year:${year.id}`).row();
  keyboard.text("🏠 الرئيسية", "nav:home");
  await ctx.editMessageText(data?.length ? "📚 اختر السنة الدراسية:" : "لا توجد سنوات دراسية مضافة حاليًا.", { reply_markup: keyboard });
}

async function showGroups(ctx: Context, yearId: string) {
  const { data: year, error: yearError } = await supabase.from("semesters").select("id, name, number").eq("id", yearId).eq("is_active", true).maybeSingle();
  if (yearError) throw yearError;
  if (!year) {
    await ctx.answerCallbackQuery({ text: "السنة الدراسية غير متاحة.", show_alert: true });
    return;
  }

  const { data: groups, error } = await supabase.from("student_groups").select("id, name, number").eq("semester_id", yearId).eq("is_active", true).order("number");
  if (error) throw error;
  const keyboard = new InlineKeyboard();
  for (const group of groups ?? []) keyboard.text(group.name || `المجموعة ${group.number}`, `group:${group.id}`).row();
  keyboard.text("🔙 رجوع", "menu:subjects").row().text("🏠 الرئيسية", "nav:home");
  await ctx.editMessageText(groups?.length ? `📚 ${year.name}\n\nاختر المجموعة:` : `📚 ${year.name}\n\nلم تُضف مجموعات لهذه السنة بعد.`, { reply_markup: keyboard });
}

async function showGroupSubjects(ctx: Context, groupId: string) {
  const { data: group, error: groupError } = await supabase.from("student_groups").select("id, name, number, semester_id").eq("id", groupId).eq("is_active", true).maybeSingle();
  if (groupError) throw groupError;
  if (!group) {
    await ctx.answerCallbackQuery({ text: "المجموعة غير متاحة.", show_alert: true });
    return;
  }

  const { data: mappings, error } = await supabase.from("subject_groups").select("subject_id").eq("group_id", groupId);
  if (error) throw error;
  const ids = [...new Set((mappings ?? []).map((row) => row.subject_id))];
  const keyboard = new InlineKeyboard();

  if (ids.length) {
    const { data: subjects, error: subjectError } = await supabase.from("subjects").select("id, name, code").in("id", ids).eq("is_active", true).order("name");
    if (subjectError) throw subjectError;
    const { data: links, error: linksError } = await supabase.from("subject_lecturers").select("subject_id, lecturer_id").in("subject_id", (subjects ?? []).map((s) => s.id));
    if (linksError) throw linksError;
    const lecturerIds = [...new Set((links ?? []).map((row) => row.lecturer_id))];
    const { data: lecturers, error: lecturerError } = lecturerIds.length
      ? await supabase.from("lecturers").select("id, name").in("id", lecturerIds).eq("is_active", true)
      : { data: [], error: null };
    if (lecturerError) throw lecturerError;

    for (const subject of subjects ?? []) {
      const lecturerNames = (links ?? [])
        .filter((link) => link.subject_id === subject.id)
        .map((link) => lecturers?.find((lecturer) => lecturer.id === link.lecturer_id)?.name)
        .filter((name): name is string => Boolean(name));
      const label = lecturerNames.length ? `${lecturerNames.join(" / ")} — ${subject.name}` : subject.name;
      keyboard.text(label.slice(0, 60), `subject:${subject.id}`).row();
    }
  }

  keyboard.text("🔙 رجوع", `year:${group.semester_id}`).row().text("🏠 الرئيسية", "nav:home");
  const groupName = group.name || `المجموعة ${group.number}`;
  await ctx.editMessageText(ids.length ? `👥 ${groupName}\n\nاختر الأستاذ أو المادة:` : `👥 ${groupName}\n\nلا توجد مواد مرتبطة بهذه المجموعة بعد.`, { reply_markup: keyboard });
}

async function deliverFile(ctx: Context, file: { id: string; title: string; description: string | null; telegram_file_id: string; file_type: string }) {
  if (!ctx.chat) return;
  const caption = [file.title, file.description].filter(Boolean).join("\n").slice(0, 900);
  switch (file.file_type) {
    case "image":
      await ctx.api.sendPhoto(ctx.chat.id, file.telegram_file_id, { caption });
      break;
    case "video":
      await ctx.api.sendVideo(ctx.chat.id, file.telegram_file_id, { caption });
      break;
    case "audio":
      await ctx.api.sendAudio(ctx.chat.id, file.telegram_file_id, { caption });
      break;
    default:
      await ctx.api.sendDocument(ctx.chat.id, file.telegram_file_id, { caption });
  }
}

async function showSubjectFiles(ctx: Context, subjectId: string) {
  const { data: subject, error: subjectError } = await supabase.from("subjects").select("id, name, code").eq("id", subjectId).eq("is_active", true).maybeSingle();
  if (subjectError) throw subjectError;
  if (!subject) {
    await ctx.answerCallbackQuery({ text: "المادة غير متاحة.", show_alert: true });
    return;
  }

  const { data: files, error } = await supabase.from("files").select("id, title, description, telegram_file_id, file_type, category_id").eq("subject_id", subjectId).eq("is_public", true).order("created_at");
  if (error) throw error;

  await ctx.editMessageText(
    `📘 ${subject.name}${subject.code ? ` (${subject.code})` : ""}\n\n` +
    (files?.length ? `عدد الملفات المتاحة: ${files.length}. جارٍ إرسالها الآن.` : "لا توجد ملفات مضافة لهذه المادة حتى الآن."),
    { reply_markup: new InlineKeyboard().text("🔙 السنوات والمجموعات", "menu:subjects").row().text("🏠 الرئيسية", "nav:home") },
  );

  for (const file of files ?? []) {
    try {
      await deliverFile(ctx, file);
    } catch (error) {
      console.error("Could not deliver file", file.id, error);
      if (ctx.chat) await ctx.api.sendMessage(ctx.chat.id, `تعذّر إرسال الملف «${file.title}».`);
    }
  }
}

bot.command("start", async (ctx: Context) => {
  try {
    const user = ctx.from;
    if (!user) return;
    await upsertTelegramUser({ telegramId: user.id, username: user.username, firstName: user.first_name, lastName: user.last_name });
    await showHome(ctx);
  } catch (error) {
    console.error("Start command failed:", error);
    await ctx.reply("حدث خطأ أثناء تشغيل البوت. حاول مرة أخرى.");
  }
});

bot.callbackQuery("subscription:check", async (ctx) => {
  await ctx.answerCallbackQuery({ text: "تم التحقق من الاشتراك." });
  await showHome(ctx);
});
bot.callbackQuery("menu:subjects", async (ctx) => { await ctx.answerCallbackQuery(); await showYears(ctx); });
bot.callbackQuery(/^year:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showGroups(ctx, ctx.match[1]); });
bot.callbackQuery(/^group:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showGroupSubjects(ctx, ctx.match[1]); });
bot.callbackQuery(/^subject:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await showSubjectFiles(ctx, ctx.match[1]); });
bot.callbackQuery("nav:home", async (ctx) => { await ctx.answerCallbackQuery(); await showHome(ctx); });

bot.catch((error) => console.error("Bot error:", error.error));
export { bot };
