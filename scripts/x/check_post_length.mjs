#!/usr/bin/env node
// articles/X投稿ストック.md の各投稿が X の文字数上限に収まっているか検査する。
//
//   node scripts/x/check_post_length.mjs          # 全件チェック(超過があれば exit 1)
//   echo "本文" | node scripts/x/check_post_length.mjs -   # 標準入力の1本だけ測る
//
// X は「重み付き文字数」で数える(twitter-text の weightedLength)。既定の重みは 200 で、
// 下記 LIGHT_RANGES に入る文字(ASCII・ラテン・一部の約物)だけが 100。日本語のかな・漢字・
// 全角約物はすべて 200 なので、上限 280 は実質「日本語で140字」になる。
// URL は t.co で短縮されるため、実際の長さに関わらず 23 文字として数える。

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LIGHT_RANGES = [
  [0x0000, 0x10ff],
  [0x2000, 0x200d],
  [0x2010, 0x201f],
  [0x2032, 0x2037],
];
const MAX_WEIGHTED = 280;
const URL_WEIGHT = 23;

export function weightedLength(text) {
  const normalized = text.replace(/https?:\/\/\S+/g, "x".repeat(URL_WEIGHT));
  let total = 0;
  for (const ch of normalized) {
    const cp = ch.codePointAt(0);
    total += LIGHT_RANGES.some(([lo, hi]) => cp >= lo && cp <= hi) ? 100 : 200;
  }
  return total / 100;
}

/** 「# A. 実データ系」以降の ### 見出し + コードブロックを投稿として抜き出す */
export function parsePosts(markdown) {
  const start = markdown.indexOf("# A. 実データ系");
  if (start === -1) throw new Error("投稿セクションの開始見出しが見つからない");
  const posts = [];
  let current = null;
  let inBlock = false;
  let buffer = [];
  for (const line of markdown.slice(start).split("\n")) {
    const heading = line.match(/^### ([A-C]-\d+)\s+(.*)$/);
    if (heading) {
      current = { id: heading[1], title: heading[2], blocks: [] };
      posts.push(current);
      continue;
    }
    if (line.startsWith("```")) {
      if (inBlock) {
        current?.blocks.push(buffer.join("\n"));
        buffer = [];
      }
      inBlock = !inBlock;
      continue;
    }
    if (inBlock) buffer.push(line);
  }
  return posts;
}

function main() {
  if (process.argv[2] === "-") {
    const text = readFileSync(0, "utf8").replace(/\n$/, "");
    const n = weightedLength(text);
    console.log(`${n} / ${MAX_WEIGHTED}  ${n > MAX_WEIGHTED ? `❌ ${n - MAX_WEIGHTED} 超過` : `✅ 残り ${MAX_WEIGHTED - n}`}`);
    process.exit(n > MAX_WEIGHTED ? 1 : 0);
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const path = join(here, "..", "..", "articles", "X投稿ストック.md");
  const posts = parsePosts(readFileSync(path, "utf8"));

  const failures = [];
  for (const post of posts) {
    // blocks[0] が本投稿、以降は自己リプ。自己リプも同じ上限で数える
    const lengths = post.blocks.map(weightedLength);
    const over = lengths.filter((n) => n > MAX_WEIGHTED);
    const label = lengths
      .map((n, i) => `${i === 0 ? "本文" : `リプ${i}`}:${n}${n > MAX_WEIGHTED ? "!" : ""}`)
      .join(" ");
    console.log(`${over.length ? "❌" : "✅"} ${post.id.padEnd(5)} ${label}`);
    if (over.length) failures.push(post.id);
  }

  console.log(`\n${posts.length} 本中 ${failures.length} 本が上限 ${MAX_WEIGHTED} を超過`);
  if (failures.length) {
    console.error(`超過: ${failures.join(", ")}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
