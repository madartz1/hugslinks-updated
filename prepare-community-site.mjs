import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const assets = '<link rel="stylesheet" href="/community-notice.css"><script defer src="/community-notice.js"></script>';
const excluded = new Set(['node_modules', 'netlify', 'assets']);
const hosts = new Map();
function prepare(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || excluded.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) prepare(path);
    if (!entry.isFile() || !path.endsWith('.html')) continue;
    const html = readFileSync(path, 'utf8');
    for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["'](https?:\/\/[^"']+)["']/gi)) {
      try {
        const hostname = new URL(match[1]).hostname;
        if (['hugslinks.com', 'www.hugslinks.com'].includes(hostname)) continue;
        if (!hosts.has(hostname)) hosts.set(hostname, new Set());
        hosts.get(hostname).add(path);
      } catch {}
    }
    if (!html.includes(assets) && /<\/head>/i.test(html)) {
      writeFileSync(path, html.replace(/<\/head>/i, assets + '\n</head>'));
    }
  }
}
prepare('.');
for (const [host, paths] of hosts) console.log(host + ': ' + [...paths].join(', '));
