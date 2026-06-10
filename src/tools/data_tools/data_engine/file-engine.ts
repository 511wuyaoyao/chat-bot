/**
 * 文件引擎 — 8 个原子操作
 * 增删改 → boolean，查 → string
 */

import fs from "fs";
import path from "path";
import { EntryData } from "./entities";

const ROOT = path.resolve(process.cwd(), "data");

// ====== 文件夹（3） ======

export function createFolder(userId: string, folderPath: string, description?: string): boolean {
  const d = path.join(ROOT, userId, folderPath);
  if (fs.existsSync(d)) return false;
  fs.mkdirSync(d, { recursive: true });
  const n = path.basename(d);
  fs.writeFileSync(path.join(d, "README.md"), `# ${n}\n\n描述：${description || `${n} 相关内容`}\n`, "utf-8");
  return true;
}

export function deleteFolder(userId: string, folderPath: string): boolean {
  const d = path.join(ROOT, userId, folderPath);
  if (!fs.existsSync(d)) return false;
  fs.rmSync(d, { recursive: true, force: true });
  return true;
}

export function deleteFile(userId: string, folderPath: string, fileName: string): boolean {
  const fp = path.join(ROOT, userId, folderPath, fileName);
  if (!fs.existsSync(fp)) return false;
  fs.unlinkSync(fp);
  return true;
}

export function updateFolder(userId: string, folderPath: string, changes: { name?: string; description?: string }): boolean {
  const d = path.join(ROOT, userId, folderPath);
  if (!fs.existsSync(d)) return false;
  if (changes.name) {
    const nd = path.join(ROOT, userId, changes.name);
    if (fs.existsSync(nd)) return false;
    fs.renameSync(d, nd);
  }
  if (changes.description !== undefined) {
    const rp = path.join(changes.name ? path.join(ROOT, userId, changes.name) : d, "README.md");
    if (fs.existsSync(rp)) {
      const c = fs.readFileSync(rp, "utf-8");
      const nx = /^描述[：:]/m.test(c)
        ? c.replace(/^描述[：:].*$/m, `描述：${changes.description}`)
        : c.replace(/^(# .+\n)/, `$1\n描述：${changes.description}\n`);
      fs.writeFileSync(rp, nx, "utf-8");
    }
  }
  return true;
}

// ====== 条目（3） ======

export function addEntry(
  userId: string, folderPath: string, fileName: string, data: EntryData
): boolean {
  const fp = path.join(ROOT, userId, folderPath, fileName);

  // 确保目录 + README + 文件存在
  if (!fs.existsSync(path.dirname(fp))) {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const fn = path.basename(path.dirname(fp));
    if (!fs.existsSync(path.join(path.dirname(fp), "README.md"))) {
      fs.writeFileSync(path.join(path.dirname(fp), "README.md"), `# ${fn}\n\n描述：${fn} 相关内容\n`, "utf-8");
    }
  }
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, `# ${fileName.replace(/\.md$/, "")}\n\n`, "utf-8");
  }

  const line = serialize(data);
  let c = fs.readFileSync(fp, "utf-8");

  // 有 status → 放到对应 H2 section 下；没有 → 直接追加到文件末尾
  const section = data.status as string | undefined;
  if (section) {
    const h2 = `## ${section}`;
    if (!c.includes(h2)) c = c.trimEnd() + `\n\n${h2}\n\n`;
    const esc = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(## ${esc}\\n)\\n*`, "u");
    const m = c.match(re);
    let pos: number;
    if (!m) { pos = c.length; }
    else {
      pos = m.index! + m[0].length;
      const nh = c.slice(pos).search(/\n##\s/);
      if (nh >= 0) pos += nh;
    }
    c = c.slice(0, pos) + line + "\n" + c.slice(pos);
  } else {
    c = c.trimEnd() + "\n" + line + "\n";
  }

  fs.writeFileSync(fp, c, "utf-8");
  return true;
}

export function deleteEntry(userId: string, title: string): boolean {
  const files = listMd(userId);
  // 精确匹配
  for (const f of files) {
    const c = fs.readFileSync(f.path, "utf-8");
    const lines = c.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (parseTitle(lines[i]) === title) {
        lines.splice(i, 1);
        fs.writeFileSync(f.path, lines.join("\n"), "utf-8");
        return true;
      }
    }
  }
  // 包含匹配回退
  for (const f of files) {
    const c = fs.readFileSync(f.path, "utf-8");
    const lines = c.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const t = parseTitle(lines[i]);
      if (t && t.includes(title)) {
        lines.splice(i, 1);
        fs.writeFileSync(f.path, lines.join("\n"), "utf-8");
        return true;
      }
    }
  }
  return false;
}

export function updateEntry(
  userId: string, title: string, data: EntryData,
  opts?: { newFolder?: string; newFile?: string }
): boolean {
  // 找到旧行
  const files = listMd(userId);
  let found: { path: string; folder: string; file: string; lineNo: number } | null = null;
  for (const f of files) {
    const lines = fs.readFileSync(f.path, "utf-8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (parseTitle(lines[i]) === title) { found = { ...f, lineNo: i }; break; }
    }
    if (found) break;
  }
  if (!found) {
    for (const f of files) {
      const lines = fs.readFileSync(f.path, "utf-8").split("\n");
      for (let i = 0; i < lines.length; i++) {
        const t = parseTitle(lines[i]);
        if (t && t.includes(title)) { found = { ...f, lineNo: i }; break; }
      }
      if (found) break;
    }
  }
  if (!found) return false;

  const newLine = serialize(data);
  const nf = opts?.newFolder ?? found.folder;
  const nfl = opts?.newFile ?? found.file;

  // 同文件：原地替换
  if (nf === found.folder && nfl === found.file) {
    const lines = fs.readFileSync(found.path, "utf-8").split("\n");
    lines[found.lineNo] = newLine;
    fs.writeFileSync(found.path, lines.join("\n"), "utf-8");
    return true;
  }

  // 跨文件：先加后删
  if (!addEntry(userId, nf, nfl, data)) return false;
  const lines = fs.readFileSync(found.path, "utf-8").split("\n");
  lines.splice(found.lineNo, 1);
  fs.writeFileSync(found.path, lines.join("\n"), "utf-8");
  return true;
}

// ====== 查出（2） ======

export function readFile(userId: string, folderPath: string, fileName: string): string {
  const fp = path.join(ROOT, userId, folderPath, fileName);
  return fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8") : "";
}

export function scanTree(userId: string): string {
  const root = path.join(ROOT, userId);
  if (!fs.existsSync(root)) return "";
  const out: string[] = [];
  let fc = 0, ec = 0;
  (function walk(d: string, indent: number) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        const pfx = "  ".repeat(indent);
        let desc = "";
        try {
          const r = fs.readFileSync(path.join(d, e.name, "README.md"), "utf-8");
          const m = r.match(/^描述[：:]\s*(.+)$/m);
          if (m) desc = ` — ${m[1]}`;
        } catch {}
        out.push(`${pfx}${e.name}/${desc}`);
        walk(path.join(d, e.name), indent + 1);
      }
    }
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isFile() || !e.name.endsWith(".md") || e.name === "README.md") continue;
      const pfx = "  ".repeat(indent);
      const c = fs.readFileSync(path.join(d, e.name), "utf-8");
      const titles: string[] = [];
      let n = 0;
      for (const l of c.split("\n")) {
        const cm = l.match(/^-\s*\[[ x\-~?]\]\s+(.+)/);
        const pm = l.match(/^-\s+(.+)/);
        const m = cm || pm;
        if (m) {
          n++;
          if (titles.length < 5) {
            const ct = m[1];
            const lk = ct.match(/^\[(.+?)\]/);
            titles.push(lk ? lk[1] : ct.split(/\s{2}|\t| {3}/)[0]?.trim() || ct.slice(0, 20));
          }
        }
      }
      out.push(`${pfx}${e.name}（${n}条${titles.length ? ` — ${titles.join("、")}` : ""}）`);
      fc++; ec += n;
    }
  })(root, 0);
  return out.length ? `当前数据目录（${fc} 个文件，${ec} 条记录）\n${out.join("\n")}` : "";
}

// ====== 序列化 ======

function serialize(data: EntryData): string {
  const ch = data.statusChar as string | undefined;
  const prefix = ch ? `- [${ch}] ${data.title}` : `- ${data.title}`;
  const parts = [prefix];
  for (const [k, v] of Object.entries(data)) {
    if (k === "title" || k === "status" || k === "statusChar" || v === undefined || v === null) continue;
    parts.push(`${k}：${v}`);
  }
  return parts.join("  ");
}

/** 从条目行解析标题（内部 & 导出共用） */
function parseTitle(line: string): string | null {
  const sm = line.match(/^-\s*\[[ x\-~?]\]\s+(.+)/);
  const pm = line.match(/^-\s+(.+)/);
  const m = sm || pm;
  if (!m) return null;
  const c = m[1];
  const lk = c.match(/^\[(.+?)\]\(.+?\)/);
  if (lk) return lk[1];
  const sep = c.search(/\s{2}|\t| {3}/);
  return sep > 0 ? c.slice(0, sep).trim() : c.trim();
}

function listMd(userId: string): { path: string; folder: string; file: string }[] {
  const base = path.join(ROOT, userId);
  if (!fs.existsSync(base)) return [];
  const r: { path: string; folder: string; file: string }[] = [];
  (function walk(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "README.md") continue;
      if (e.isDirectory()) walk(path.join(d, e.name));
      else if (e.name.endsWith(".md")) {
        const rel = path.relative(base, path.join(d, e.name)).replace(/\\/g, "/");
        const ls = rel.lastIndexOf("/");
        r.push({ path: path.join(d, e.name), folder: ls < 0 ? "" : rel.slice(0, ls), file: ls < 0 ? rel : rel.slice(ls + 1) });
      }
    }
  })(base);
  return r;
}

