// src/webhook-server.js ——【进阶脚手架，第二步再接】自动触发的"门铃"

import http from 'node:http';
import { parseDiff, diffToPromptText, countAddedLines } from './diff.js';
import { buildContextBlock } from './rag.js';
import { buildMessages } from './prompt.js';
import { review } from './llm.js';
import { parseModelOutput, renderMarkdown } from './report.js';
import { config } from './config.js';
import path from 'node:path';

const PORT = process.env.PORT || 3000;

// 复用同一套评审管线，只是输入从"本地文件"换成"webhook 收到的 diff"
async function runReview({ diffText, title, body, live }) {
  const files = parseDiff(diffText);
  const addedLines = countAddedLines(files);
  const contextText = config.rag.enabled
    ? buildContextBlock(diffText, path.resolve(config.rag.docsDir), config.rag.topK)
    : '';
  const messages = buildMessages({ diffText, contextText, title, body });
  const raw = await review(messages, { live, files });
  const result = parseModelOutput(raw);
  return renderMarkdown(result, { addedLines, mode: live && config.llm.apiKey ? 'live' : 'mock' });
}

const server = http.createServer(async (req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404).end('not found');
    return;
  }

  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', async () => {
    try {
      // TODO 1：校验请求头 X-Hub-Signature-256 是否由你的 WEBHOOK_SECRET 签名，不符直接 403。
      const event = JSON.parse(body);

      // 只在 PR 新建或更新时评审
      const action = event.action;
      if (!['opened', 'synchronize', 'reopened'].includes(action)) {
        res.writeHead(200).end('ignored');
        return;
      }

      const pr = event.pull_request || {};
      // TODO 2：用 GitHub token 请求 `${pr.diff_url}`（Accept: application/vnd.github.v3.diff）拿到 diff 文本；
      //         评审完成后，POST 到 `${pr.comments_url}` 把 markdown 作为评论发回 PR。
      // 这里先打印事件，证明门铃响了。
      console.log(`收到 PR 事件 [${action}] #${pr.number} ${pr.title}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, received: pr.number }));
    } catch (e) {
      res.writeHead(500).end('error: ' + e.message);
    }
  });
});

server.listen(PORT, () => console.log(`webhook 服务已启动：http://localhost:${PORT}/webhook`));

// 导出给测试用
export { runReview };
