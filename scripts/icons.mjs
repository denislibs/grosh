// Собирает имена Material Symbols, которые реально встречаются в коде,
// сверяет их с официальным списком и вписывает в ссылку шрифта в apps/web/index.html.
// Google отдаёт ошибку на весь запрос, если хотя бы одно имя неверное, поэтому проверка обязательна.
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cacheFile = join(root, 'scripts/.cache/material-symbols-rounded.codepoints');
const CODEPOINTS = 'https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsRounded%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints';
const targets = [join(root, 'apps/web/index.html')];

async function knownNames() {
  if (!existsSync(cacheFile)) {
    const res = await fetch(CODEPOINTS);
    if (!res.ok) throw new Error('Не удалось скачать список иконок: ' + res.status);
    mkdirSync(dirname(cacheFile), { recursive: true });
    writeFileSync(cacheFile, await res.text());
  }
  return new Set(readFileSync(cacheFile, 'utf8').split('\n').map(l => l.split(' ')[0]).filter(Boolean));
}

const walk = d => readdirSync(d).flatMap(f => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(js|css)$/.test(f) ? [p] : [];
});

const known = await knownNames();
const candidates = new Set();
for (const f of [...walk(join(root, 'packages/ui-kit/src')), ...walk(join(root, 'apps/web/src'))]) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/['"`>]([a-z][a-z0-9_]{1,40})['"`<]/g)) candidates.add(m[1]);
  for (const m of text.matchAll(/content:\s*"([a-z_]+)"/g)) candidates.add(m[1]);
}
// слова, которые совпадают с именами иконок, но в коде значат другое
const skip = new Set(['system', 'light', 'dark', 'full', 'expense', 'income', 'transfer', 'gold', 'silver', 'bronze', 'locked', 'ok', 'error_outline', 'start', 'end', 'none', 'auto', 'merge', 'replace', 'email', 'grid', 'block', 'inline', 'center', 'bold', 'login', 'week', 'month', 'year', 'all', 'gap']);
const names = [...candidates].filter(n => known.has(n) && !skip.has(n)).sort();
// обязательные: используются в CSS и в данных, которые сканер может не увидеть
for (const n of ['unfold_more', 'error', 'check_circle', 'delete']) if (!names.includes(n)) names.push(n);
names.sort();

for (const file of targets) {
  const html = readFileSync(file, 'utf8');
  const next = html.replace(/icon_names=[^&"]*/, 'icon_names=' + names.join(','));
  writeFileSync(file, next);
}
const url = `https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,400..600,0..1,0&icon_names=${names.join(',')}&display=block`;
const check = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 Chrome/130' } }).catch(() => null);
console.log(`Иконок: ${names.length}. Проверка шрифта: ${check ? check.status : 'нет сети'}`);
if (check && !check.ok) process.exit(1);
