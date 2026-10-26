// src/prompt.js —— 第⑤层前半：把所有材料组装成发给大模型的 prompt（任务书）

import { config } from './config.js';

// system：定角色、定边界、定输出格式。这一段每次评审都一样。
const SYSTEM_PROMPT = `你是一名严格但友善的资深前端代码评审工程师（Reviewer）。

工作规则（必须遵守）：
1. 只评审本次【新增/修改】的代码，不要评价未改动的历史代码，不要整篇重写建议。
2. 每条意见必须能定位到具体文件和行号，引用相关代码作为证据，禁止空泛表扬。
3. 不要重复格式化、拼写这类 linter 已经能查出的问题。
4. 不确定是不是问题时，标注为 minor 并说明"建议人工确认"，禁止编造不存在的 API 或库。
5. 按给定的检查清单逐条过，并对照检索到的项目规范。

输出要求：只输出一个 JSON 对象，不要输出 JSON 以外的任何文字（不要代码块包裹、不要解释），结构如下：
{
  "summary": "3 句话以内的整体评价",
  "findings": [
    {
      "file": "文件路径",
      "line": 数字行号（新增代码在新版本中的行号，不确定给 null）,
      "severity": "blocker | major | minor",
      "issue": "问题是什么（一句话）",
      "evidence": "引用出问题的代码片段",
      "suggestion": "具体怎么改，给出可直接采用的改法"
    }
  ]
}
没有发现问题时，findings 返回空数组 []。`;

/**
 * 组装 messages（OpenAI 兼容格式）
 * @param {{diffText:string, contextText:string, title:string, body:string}} input
 */
export function buildMessages({ diffText, contextText, title = '', body = '' }) {
  const checklistText = config.checklist.map((c, i) => `${i + 1}. ${c}`).join('\n');

  const userContent = [
    `## 本次 PR 标题\n${title || '（无）'}`,
    `## PR 描述\n${body || '（无）'}`,
    contextText ? `## ${contextText}` : '',
    `## 需要逐条对照的检查清单\n${checklistText}`,
    `## 本次代码改动（unified diff，+ 为新增）\n${diffText}`,
    '请按 system 要求输出 JSON。',
  ]
    .filter(Boolean)
    .join('\n\n');

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ];
}
