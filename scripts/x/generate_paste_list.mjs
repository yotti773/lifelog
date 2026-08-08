#!/usr/bin/env node
// articles/X投稿ストック.md から articles/X予約投稿_貼り付け用.md を生成する。
//
//   node scripts/x/generate_paste_list.mjs
//
// 貼り付け用は「日付・時刻・本文だけ」に絞った作業用ファイル。本文を2ファイルに手で持つと
// 必ずズレる(実際に2026-08-08、ストック側だけ17本書き直してズレた)ため、正はストック本体
// のみとし、こちらは常に生成物として扱う。編集したくなったらストック本体を直して再生成する。
//
// 予約に流すのは「自己リプの無いA・Bのうち、要更新/要確認が付いていないもの」だけ。
// カテゴリCは自己リプで記事URLを出すスレッド型で、X公式の予約はスレッドを組めないため手動。

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parsePosts, weightedLength } from "./check_post_length.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const STOCK = join(here, "..", "..", "articles", "X投稿ストック.md");
const OUT = join(here, "..", "..", "articles", "X予約投稿_貼り付け用.md");

const md = readFileSync(STOCK, "utf8");

/** 各投稿のメタ行(カテゴリ / 要更新 / 画像 / 使用日)を拾う */
function parseMeta(markdown) {
  const meta = new Map();
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const h = lines[i].match(/^### ([A-C]-\d+)\s/);
    if (!h) continue;
    const line = lines.slice(i + 1, i + 4).find((l) => l.includes("使用日")) ?? "";
    const img = line.match(/画像:\s*`([^`]+)`/);
    meta.set(h[1], {
      image: img ? img[1] : null,
      flagged: /要更新|要確認/.test(line),
      used: !/使用日:\s*—/.test(line),
    });
  }
  return meta;
}

/** 投稿カレンダー(2列組みの表)から 通し番号・日付・投稿ID を拾う */
function parseCalendar(markdown) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const cells = line.split("|");
    for (const [n, d, p] of [cells.slice(1, 4), cells.slice(5, 8)]) {
      if (!n || !d || !p) continue;
      const id = p.match(/([A-C]-\d+)/);
      const date = d.match(/(\d+)\/(\d+)\((.)\)/);
      if (id && date) rows.push({ no: Number(n.trim()), date: d.trim(), weekday: date[3], id: id[1] });
    }
  }
  return rows.sort((a, b) => a.no - b.no);
}

// 予約時刻: B(技術ネタ)は平日8:00・土日9:00、A(実データ)は22:00
function slotTime(id, weekday) {
  if (id.startsWith("B")) return "土日".includes(weekday) ? "9:00" : "8:00";
  return "22:00";
}

const posts = new Map(parsePosts(md).map((p) => [p.id, p]));
const meta = parseMeta(md);
const calendar = parseCalendar(md);

const scheduled = [];
const manual = [];
for (const row of calendar) {
  const post = posts.get(row.id);
  const m = meta.get(row.id) ?? {};
  if (m.used) continue; // 消費済みは載せない
  const hasReply = (post?.blocks.length ?? 0) > 1;
  const isC = row.id.startsWith("C");
  if (isC || m.flagged) {
    manual.push({ ...row, reason: isC && m.flagged ? "自己リプあり + 要確認" : isC ? "自己リプあり(スレッド)" : "要更新・要確認" });
  } else {
    scheduled.push({ ...row, post, image: m.image, hasReply });
  }
}

const imageRows = scheduled.filter((s) => s.image).map((s) => `| ${s.id}(${s.date}) | \`${s.image}\` |`);

const out = `# X予約投稿 貼り付け用(${scheduled.length}本)

**このファイルは生成物。正は \`X投稿ストック.md\`** — 文面を直すときはストック本体を直して \`node scripts/x/generate_paste_list.mjs\` で作り直す。ここを直接編集しない(本文を2ファイルに手で持つと必ずズレる)。

## 使い方

1. PCブラウザで x.com を開く(スマホアプリには予約投稿機能が無い)
2. 投稿ボックス → カレンダーアイコン → 日時を指定 → 予約
3. 下の順に上から${scheduled.length}本。日付・時刻はそのまま入れる

**画像を付けるもの**(予約時に添付する。ファイルは \`articles/\` 直下):

| 投稿 | 画像 |
|---|---|
${imageRows.join("\n")}

---

${scheduled
  .map(
    (s, i) =>
      `## ${i + 1}. ${s.date}${slotTime(s.id, s.weekday)} — ${s.id}${s.image ? ` 【画像: \`${s.image}\`】` : ""}\n\n` +
      "```\n" +
      `${s.post.blocks[0]}\n` +
      "```\n" +
      `\n<sub>${weightedLength(s.post.blocks[0])} / 280</sub>\n`
  )
  .join("\n")}
---

## 予約しない${manual.length}本(当日に手動)

自己リプを伴うスレッドは公式予約で組めない。要更新・要確認のものは投稿直前に数字を確認する。

| 日付 | 投稿 | 理由 |
|---|---|---|
${manual.map((m) => `| ${m.date} | ${m.id} | ${m.reason} |`).join("\n")}

文面は \`X投稿ストック.md\` を参照。
`;

writeFileSync(OUT, out);
console.log(`生成: ${OUT}`);
console.log(`予約 ${scheduled.length}本 / 手動 ${manual.length}本`);
