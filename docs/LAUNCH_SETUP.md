# QanunHub launch checklist

## Required Vercel environment variables

Set these in the QanunHub Vercel project for **Production** and **Preview** as appropriate:

- `TELEGRAM_BOT_TOKEN`: a newly rotated token from @BotFather. Never commit it.
- `SUPABASE_URL`: the QanunHub project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-side secret only; never expose it in client-side code.
- `STUDENT_UNION_CHANNEL_ID`: `@ZULSUtarhuna`.
- `STUDENT_UNION_CHANNEL_URL`: `https://t.me/ZULSUtarhuna`.
- `ADMIN_SECRET`: a long, randomly generated secret if used by the admin interface.

The bot must be an administrator in the student-union channel for reliable `getChatMember` checks.

## Database

The groups migration creates `student_groups` and `subject_groups`, and hardens the `set_updated_at()` function. Apply migrations through Supabase migration tooling; do not run the same SQL manually in production if the migration has already been recorded.

Before launch, verify:
1. Four active academic years/semesters have the expected names.
2. Each year has active groups.
3. Each group is mapped to the right subjects.
4. Each subject has its lecturer mapping and public files.
5. File rows contain valid Telegram `file_id` values and public visibility is intentional.

## Telegram webhook and smoke test

After a successful deployment, set the Telegram webhook to the deployed endpoint `https://<production-domain>/api/telegram` using the Bot API. Do not expose the bot token in a public URL, issue, log, or commit.

Test with a non-member account and a subscribed account:
- Non-member receives the channel link and cannot browse.
- After joining and pressing “تحقّق من الاشتراك”, the bot opens.
- Start → year → group → subject sends the files.
- Empty years/groups/subjects show an informative message.
- A temporarily unavailable database or Telegram API does not leak secrets.

## Security

A Telegram bot token was previously committed to a public repository. Revoke it in @BotFather and use only the replacement token in Vercel. Replacing the value in `.env.example` does not revoke the old credential. Rotate any other credential that was ever committed.
