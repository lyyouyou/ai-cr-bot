// src/llm.js —— 第⑤层后半：调用大模型（OpenAI 兼容接口），无密钥时走离线 mock

import { config } from './config.js';

/**
 * 调用 OpenAI 兼容的 chat/completions 接口
 * @returns {Promise<string>} 模型返回的文本（应为 JSON 字符串）
 */
async function callRemote(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000); // 30 秒超时兜底
  try {
    const res = await fetch(`${config.llm.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.llm.apiKey}`,
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: config.llm.model,
        messages,
        temperature: config.llm.temperature,
        response_format: { type: 'json_object' }, // 要求直接给 JSON（部分服务商支持，不支持会忽略）
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`模型接口返回 ${res.status}: ${errText.slice(0, 300)}`);
    }
    const data = await res.json();
    return data.choices[0].message.content;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 离线 mock reviewer：用几条简单规则扫新增行，产出和真模型同构的 JSON。
 * 注意：这只是演示输出格式，真正的智能判断交给真模型。
 */
function mockReview(files) {
  const findings = [];
  const rules = [
    {
      re: /dangerouslySetInnerHTML/,
      severity: 'blocker',
      issue: '使用了 dangerouslySetInnerHTML 渲染内容，存在 XSS 风险',
      suggestion: '改用安全渲染方式；确需富文本请先做白名单消毒。',
    },
    {
      re: /\bfetch\s*\(/,
      severity: 'major',
      issue: '组件内裸写 fetch，未使用项目封装的 useRequest',
      suggestion: '统一改用 src/hooks/useRequest.ts，便于处理 loading 与错误。',
    },
    {
      re: /\.then\(/,
      severity: 'major',
      issue: 'Promise 链路缺少 catch/finally，失败时 loading 不会复位',
      suggestion: '补充 .catch 并在 .finally 里关闭 loading。',
    },
    {
      re: /key=\{?["']?index/,
      severity: 'major',
      issue: '列表 key 使用 index，列表增删时可能造成渲染错乱',
      suggestion: '使用稳定唯一 id 作为 key。',
    },
    {
      re: /setInterval/,
      severity: 'minor',
      issue: 'setInterval 需在 useEffect cleanup 中清理，避免内存泄漏',
      suggestion: '在返回的清理函数里调用 clearInterval。',
    },
  ];

  for (const file of files) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type !== 'add') continue;
        for (const rule of rules) {
          if (rule.re.test(line.content)) {
            findings.push({
              file: file.path,
              line: line.newLine,
              severity: rule.severity,
              issue: rule.issue,
              evidence: line.content.trim(),
              suggestion: rule.suggestion,
            });
          }
        }
      }
    }
  }

  return JSON.stringify({
    summary: `（离线 mock 模式）共扫描 ${files.reduce((n, f) => n + f.hunks.length, 0)} 个改动块，命中 ${findings.length} 条演示规则；接入真实模型后会给出更深入的逻辑与设计判断。`,
    findings,
  });
}

/**
 * 对外统一入口
 * @param {object} messages OpenAI 格式消息
 * @param {{live:boolean, files:Array}} opt live=true 且有 key 才调真模型
 */
export async function review(messages, { live, files }) {
  if (live && config.llm.apiKey) {
    return await callRemote(messages);
  }
  // 没开 live 或没 key：走 mock
  return mockReview(files);
}
