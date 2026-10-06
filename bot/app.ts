import { InlineKeyboard, type Context } from "grammy";
import { bot } from "./config/telegram.js";
import { supabase } from "./config/supabase.js";
import { upsertTelegramUser } from "./services/user.service.js";

async function showHome(ctx: Context) {
  const keyboard = new InlineKeyboard()
    .text("📚 المواد الدراسية", "menu:subjects")
    .row()
    .text("📝 أسئلة السنوات", "menu:exams")
    .text("📑 الملخصات", "menu:summaries")
    .row()
    .text("📢 الإعلانات", "menu:announcements")
    .row()
    .text("🔎 البحث", "menu:search")
    .row()
    .text("💬 مجتمع الطلبة", "menu:community");

  const text =
    "🎓 كلية القانون\n" +
    "جامعة الزيتونة\n\n" +
    "مرحبًا بك في البوت التعليمي لكلية القانون.\n\n" +
    "يمكنك من خلال البوت الوصول إلى:\n" +
    "📚 المحاضرات والملفات الدراسية\n" +
    "📑 الملخصات\n" +
    "📝 أسئلة السنوات\n" +
    "👨‍🏫 ملفات المحاضرين\n" +
    "📢 الإعلانات والتنبيهات";

  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  } else {
    await ctx.reply(text, { reply_markup: keyboard });
  }
}

async function showYears(ctx: Context) {
  const { data, error } = await supabase
    .from("semesters")
    .select("id, number, name")
    .eq("is_active", true)
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`Failed to load semesters: ${error.message}`);
  }

  const keyboard = new InlineKeyboard();

  for (const semester of data ?? []) {
    keyboard
      .text(`${semester.number}️⃣ ${semester.name}`, `semester:${semester.id}`)
      .row();
  }

  keyboard.text("🏠 الرئيسية", "nav:home");

  await ctx.editMessageText(
    "📚 المواد الدراسية\n\nاختر السنة الدراسية:",
    { reply_markup: keyboard },
  );
}

async function showSemesterSubjects(ctx: Context, semesterId: string) {
  const { data: semester, error: semesterError } = await supabase
    .from("semesters")
    .select("id, number, name")
    .eq("id", semesterId)
    .eq("is_active", true)
    .maybeSingle();

  if (semesterError) {
    throw new Error(`Failed to load semester: ${semesterError.message}`);
  }

  if (!semester) {
    await ctx.answerCallbackQuery({
      text: "السنة الدراسية غير متاحة.",
      show_alert: true,
    });
    return;
  }

  const { data: subjects, error: subjectsError } = await supabase
    .from("subjects")
    .select("id, name, code")
    .eq("semester_id", semesterId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (subjectsError) {
    throw new Error(`Failed to load subjects: ${subjectsError.message}`);
  }

  const keyboard = new InlineKeyboard();

  for (const subject of subjects ?? []) {
    keyboard
      .text(
        subject.code ? `${subject.name} (${subject.code})` : subject.name,
        `subject:${subject.id}`,
      )
      .row();
  }

  keyboard.text("🔙 رجوع", "menu:subjects").row();
  keyboard.text("🏠 الرئيسية", "nav:home");

  const text = subjects?.length
    ? `📚 ${semester.name}\n\nاختر المادة:`
    : `📚 ${semester.name}\n\nلا توجد مواد مضافة لهذه السنة حاليًا.\n\nسيتم إدراج المواد بعد اعتماد ومراجعة البيانات الأكاديمية.`;

  await ctx.editMessageText(text, { reply_markup: keyboard });
}

async function showSubject(ctx: Context, subjectId: string) {
  const { data: subject, error } = await supabase
    .from("subjects")
    .select("id, name, code, semester_id")
    .eq("id", subjectId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load subject: ${error.message}`);
  }

  if (!subject) {
    await ctx.answerCallbackQuery({
      text: "المادة غير متاحة.",
      show_alert: true,
    });
    return;
  }

  const keyboard = new InlineKeyboard()
    .text("🔙 رجوع", `semester:${subject.semester_id}`)
    .row()
    .text("🏠 الرئيسية", "nav:home");

  await ctx.editMessageText(
    `📘 ${subject.name}${subject.code ? `\nالرمز: ${subject.code}` : ""}\n\nسيتم عرض ملفات المادة هنا بعد إضافتها.`,
    { reply_markup: keyboard },
  );
}

async function showPlaceholder(
  ctx: Context,
  title: string,
  backCallback = "nav:home",
) {
  const keyboard = new InlineKeyboard()
    .text("🔙 رجوع", backCallback)
    .row()
    .text("🏠 الرئيسية", "nav:home");

  await ctx.editMessageText(
    `${title}\n\nهذا القسم قيد التجهيز حاليًا.`,
    { reply_markup: keyboard },
  );
}

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

    await showHome(ctx);
  } catch (error) {
    console.error("Start command error:", error);
    await ctx.reply("حدث خطأ أثناء تحميل البوت. حاول مرة أخرى.");
  }
});

bot.callbackQuery("menu:subjects", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showYears(ctx);
});

bot.callbackQuery(/^semester:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showSemesterSubjects(ctx, ctx.match[1]);
});

bot.callbackQuery(/^subject:(.+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  await showSubject(ctx, ctx.match[1]);
});

bot.callbackQuery("nav:home", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showHome(ctx);
});

bot.callbackQuery("menu:exams", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlaceholder(ctx, "📝 أسئلة السنوات");
});

bot.callbackQuery("menu:summaries", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlaceholder(ctx, "📑 الملخصات");
});

bot.callbackQuery("menu:announcements", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlaceholder(ctx, "📢 الإعلانات");
});

bot.callbackQuery("menu:search", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlaceholder(ctx, "🔎 البحث");
});

bot.callbackQuery("menu:community", async (ctx) => {
  await ctx.answerCallbackQuery();
  await showPlaceholder(ctx, "💬 مجتمع الطلبة");
});

bot.catch((error) => {
  console.error("Bot error:", error.error);
});

export { bot };
