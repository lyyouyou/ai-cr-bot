// cli.js —— 总入口：把前面所有层串成一条流水线
// 用法：
//   离线演示：  node cli.js --diff examples/buggy.diff
//   真实模型：  LLM_API_KEY=xxx LLM_BASE_URL=... LLM_MODEL=... node cli.js --diff examples/buggy.diff --live

import fs from 'node:fs';
import path from 'node:path';
import { parseDiff, diffToPromptText, countAddedLines } from './src/diff.js';
import { buildContextBlock } from './src/rag.js';
import { buildMessages } from './src/prompt.js';
import { review } from './src/llm.js';
import { parseModelOutput, renderMarkdown } from './src/report.js';
import { config } from './src/config.js';

// 手写一个极简参数解析（不依赖第三方库）
function parseArgs(argv) {
  const args = { live: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--live') args.live = true;
    else if (argv[i] === '--diff') args.diff = argv[++i];
    else if (argv[i] === '--title') args.title = argv[++i];
    else if (argv[i] === '--body') args.body = argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.diff) {
    console.error('用法：node cli.js --diff <diff文件> [--live] [--title "标题"] [--body "描述"]');
    process.exit(1);
  }

  const diffPath = path.resolve(args.diff);
  if (!fs.existsSync(diffPath)) {
    console.error('找不到 diff 文件：', diffPath);
    process.exit(1);
  }

  // ① 触发/输入：读入 diff
  const rawDiff = fs.readFileSync(diffPath, 'utf8');
  // ② 预处理：解析成结构化改动
  const files = parseDiff(rawDiff);
  if (files.length === 0) {
    console.log('未解析到任何文件改动，退出。');
    return;
  }
  const addedLines = countAddedLines(files);
  const diffText = diffToPromptText(files);

  // ④ RAG：检索相关规范（可在 config 关掉）
  const contextText = config.rag.enabled
    ? buildContextBlock(diffText, path.resolve(config.rag.docsDir), config.rag.topK)
    : '';

  // ⑤ Prompt 组装 → LLM
  const messages = buildMessages({
    diffText,
    contextText,
    title: args.title,
    body: args.body,
  });

  console.log(`→ 正在评审（${args.live && config.llm.apiKey ? '真实模型' : '离线 mock'}），新增 ${addedLines} 行...\n`);
  const rawModelOutput = await review(messages, { live: args.live, files });

  // ⑥ 解析校验 + 渲染
  let result;
  try {
    result = parseModelOutput(rawModelOutput);
  } catch (e) {
    console.error('解析模型输出失败：', e.message);
    process.exit(1);
  }
  const markdown = renderMarkdown(result, { addedLines, mode: args.live && config.llm.apiKey ? 'live' : 'mock' });

  console.log(markdown);

  // 把评论落盘，方便你以后直接贴到 PR
  const outPath = path.resolve('review-output.md');
  fs.writeFileSync(outPath, markdown, 'utf8');
  console.log(`\n✅ 已写入 ${outPath}`);
}

main().catch((e) => {
  console.error('运行出错：', e.message);
  process.exit(1);
});
