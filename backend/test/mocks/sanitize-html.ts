// Jest 30 cannot execute sanitize-html's nested ESM parser in this CommonJS test suite.
// Production uses the real library; this deterministic adapter only keeps app-level E2E bootable.
export default function sanitizeHtmlForTests(input: string): string {
  return input
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '')
    .replace(/\sstyle\s*=\s*("[^"]*"|'[^']*')/gi, '');
}
