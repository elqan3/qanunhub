import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(
  _req: IncomingMessage,
  res: ServerResponse,
): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QanunHub</title>
  <meta name="description" content="منصة الملفات الدراسية لطلاب كلية القانون.">
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f7fb; color: #172033; }
    main { max-width: 620px; margin: 24px; padding: 32px; background: white; border: 1px solid #e3e8f0; border-radius: 20px; }
    h1 { margin-top: 0; }
    a { color: #155eef; }
  </style>
</head>
<body>
  <main>
    <h1>QanunHub</h1>
    <p>منصة الملفات الدراسية لطلاب كلية القانون.</p>
    <p>للوصول إلى المواد والملفات الدراسية، استخدم بوت Telegram الخاص بالمنصة.</p>
    <a href="https://t.me/ZULSUtarhuna">قناة اتحاد الطلبة</a>
  </main>
</body>
</html>`);
}
