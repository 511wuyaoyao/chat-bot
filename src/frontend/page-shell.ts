/**
 * Frontend React 应用 HTML 外壳。
 */

export function debugPageShell(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QQ Bot Frontend</title>
  <link rel="stylesheet" href="/frontend/assets/styles.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/frontend/assets/client.js"></script>
</body>
</html>`;
}
