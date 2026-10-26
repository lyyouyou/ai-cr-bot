// src/rag.js —— 第④层：轻量 RAG 检索（Retrieval-Augmented Generation，检索增强生成）

import fs from 'node:fs';
import path from 'node:path';

// 把一段文字切成"可比较的词"：英文/代码按单词，中文按相邻两字（bigram），粗但够用
function tokenize(text) {
  const tokens = new Set();
  const asciiWords = text.match(/[a-zA-Z][a-zA-Z0-9_]{1,}/g) || [];
  asciiWords.forEach((w) => tokens.add(w.toLowerCase()));
  const cjk = text.match(/[\u4e00-\u9fa5]/g) || [];
  for (let i = 0; i < cjk.length - 1; i++) tokens.add(cjk[i] + cjk[i + 1]);
  return tokens;
}

// 递归读取目录下所有 .md，按 "## 标题" 切成一个个知识块（chunk）
export function loadDocs(docsDir) {
  const blocks = [];
  if (!fs.existsSync(docsDir)) return blocks;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.md')) {
        const raw = fs.readFileSync(full, 'utf8');
        // 按二级标题切块：# 标题是整篇，## 是小节
        const sections = raw.split(/\n##\s+/);
        for (const sec of sections) {
          const title = sec.split('\n')[0].trim();
          if (title) blocks.push({ source: entry.name, title, body: sec.trim() });
        }
      }
    }
  };
  walk(docsDir);
  return blocks;
}

/**
 * 关键词检索：返回和 diff 最相关的 topK 个知识块
 * @param {string} query 本次改动文本
 * @param {Array} docs 知识库块
 * @param {number} topK 取前几条
 */
export function retrieve(query, docs, topK = 3) {
  const qTokens = tokenize(query);
  const scored = docs.map((doc) => {
    const dTokens = tokenize(doc.body + ' ' + doc.title);
    let score = 0;
    for (const t of qTokens) {
      if (dTokens.has(t)) score += doc.title.includes(t) ? 3 : 1; // 标题命中权重更高
    }
    return { doc, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.doc);
}

// 组装成给 prompt 用的规范上下文文本
export function buildContextBlock(query, docsDir, topK) {
  if (!fs.existsSync(docsDir)) return '';
  const docs = loadDocs(docsDir);
  const hits = retrieve(query, docs, topK);
  if (hits.length === 0) return '';
  const lines = ['【检索到的本项目相关规范，评审时必须对照遵守】'];
  for (const h of hits) {
    lines.push(`- [${h.source} · ${h.title}] ${h.body}`);
  }
  return lines.join('\n');
}
