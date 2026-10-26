// src/diff.js —— 第②层：把 unified diff 文本拆成结构化的"文件 + 改动行"

/**
 * 解析 unified diff 字符串
 * @param {string} text 原始 diff
 * @returns {{path:string, hunks:Array}[]}
 */
export function parseDiff(text) {
  const lines = text.split(/\r?\n/);
  const files = [];
  let current = null;
  let currentHunk = null;
  let newLineNo = 0; // 当前在新版本里的行号

  for (const raw of lines) {
    // 匹配新文件路径：+++ b/src/App.js
    const plusFile = raw.match(/^\+\+\+\s+b\/(.+)$/);
    if (plusFile) {
      current = { path: plusFile[1], hunks: [] };
      files.push(current);
      continue;
    }

    // 匹配 hunk 头：@@ -旧起,旧数 +新起,新数 @@
    const hunkHead = raw.match(/^@@\s+-\d+(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkHead && current) {
      newLineNo = parseInt(hunkHead[1], 10);
      currentHunk = { header: raw, lines: [] };
      current.hunks.push(currentHunk);
      continue;
    }

    if (!current || !currentHunk) continue;

    if (raw.startsWith('+')) {
      currentHunk.lines.push({ type: 'add', newLine: newLineNo++, content: raw.slice(1) });
    } else if (raw.startsWith('-')) {
      currentHunk.lines.push({ type: 'del', newLine: null, content: raw.slice(1) });
    } else {
      // 上下文行，行号也要往下走
      currentHunk.lines.push({ type: 'ctx', newLine: newLineNo++, content: raw.slice(1) });
    }
  }
  return files;
}

/**
 * 把结构化 diff 压缩成给模型看的纯文本：只保留新增行和少量上下文，控制 token 长度。
 */
export function diffToPromptText(files) {
  const out = [];
  for (const file of files) {
    out.push(`### 文件 ${file.path}`);
    for (const hunk of file.hunks) {
      out.push(hunk.header);
      for (const l of hunk.lines) {
        if (l.type === 'add') out.push(`+${l.content}`);
        else if (l.type === 'ctx') out.push(` ${l.content}`);
        // 删除行不喂给模型（已不存在），减少噪声
      }
    }
    out.push('');
  }
  return out.join('\n');
}

/** 统计本次新增了多少行，用于报告概览 */
export function countAddedLines(files) {
  let n = 0;
  for (const f of files) for (const h of f.hunks) for (const l of h.lines) if (l.type === 'add') n++;
  return n;
}
