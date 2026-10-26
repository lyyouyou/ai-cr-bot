// src/report.js —— 第⑥层：解析模型输出、校验字段、渲染成可直接贴进 PR 的 Markdown 评论

import { config } from './config.js';

const SEV_ORDER = { blocker: 0, major: 1, minor: 2 };

/** 把模型返回文本里的 JSON 抠出来（容错：可能被 ```json 包裹，或前后有废话） */
export function parseModelOutput(raw) {
  let text = String(raw || '').trim();
  // 去掉 ```json ... ``` 代码块包裹
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  // 截取第一个 { 到最后一个 }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型没有返回合法 JSON，原始输出：' + text.slice(0, 200));
  }
  const obj = JSON.parse(text.slice(start, end + 1));

  // 校验并清洗每条 finding，缺字段的直接丢弃，防止渲染报错
  const findings = (Array.isArray(obj.findings) ? obj.findings : [])
    .map((f) => ({
      file: String(f.file || '未知文件'),
      line: Number.isFinite(Number(f.line)) ? Number(f.line) : null,
      severity: ['blocker', 'major', 'minor'].includes(f.severity) ? f.severity : 'minor',
      issue: String(f.issue || '').trim(),
      evidence: String(f.evidence || '').trim(),
      suggestion: String(f.suggestion || '').trim(),
    }))
    .filter((f) => f.issue);

  findings.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity]);
  return { summary: String(obj.summary || '').trim(), findings };
}

const SEV_BADGE = {
  blocker: '🔴 blocker · 必须修复',
  major: '🟠 major · 建议修复',
  minor: '🟡 minor · 可选优化',
};

/** 渲染成 Markdown，可直接作为 PR 评论正文 */
export function renderMarkdown({ summary, findings }, { addedLines, mode }) {
  const lines = [];
  lines.push(`## 🤖 AI 代码评审${mode === 'live' ? '（真实模型）' : '（离线 mock 演示）'}`);
  lines.push('');
  lines.push(`> 本次新增 ${addedLines} 行；AI 仅提供建议，最终是否采纳由人工决定。`);
  lines.push('');
  if (summary) lines.push(`**总评**：${summary}\n`);

  if (findings.length === 0) {
    lines.push('✅ 未发现明显问题。');
    return lines.join('\n');
  }

  lines.push(`共 ${findings.length} 条意见：\n`);
  findings.forEach((f, i) => {
    const loc = f.line ? `${f.file}:${f.line}` : f.file;
    lines.push(`### ${i + 1}. ${SEV_BADGE[f.severity]} — \`${loc}\``);
    lines.push(`- **问题**：${f.issue}`);
    if (f.evidence) lines.push(`- **证据**：\`\`\`js\n${f.evidence}\n\`\`\``);
    lines.push(`- **建议**：${f.suggestion || '（待补充）'}`);
    lines.push('');
  });
  return lines.join('\n');
}
