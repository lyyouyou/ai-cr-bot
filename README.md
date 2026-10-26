# 从零搭一个 AI 自动化代码评审（Code Review）流程

不装任何第三方依赖，用 Node.js 内置模块，先离线跑通整条流水线，再接真实模型。

## 0. 一条流水线长这样

```
PR 事件 → 读 diff → (硬规则工具) → RAG 捞规范 → 组装 Prompt → 调 LLM → 结构化 JSON → 渲染成 PR 评论 → 人工拍板
```

对应代码里的文件：

| 架构层 | 代码文件 | 这一层在干嘛 |
|---|---|---|
| ② 预处理 | `src/diff.js` | 把 Git 的 diff 文本拆成"哪个文件、哪几行是新增" |
| ④ RAG 检索 | `src/rag.js` | 评审前从 `docs/` 捞出和本次改动相关的团队规范 |
| ⑤ Prompt 组装 | `src/prompt.js` | 把角色、检查清单、规范、diff 拼成给模型的任务书 |
| ⑤ 调 LLM | `src/llm.js` | 有密钥调真实模型；没有就走离线 mock 演示 |
| ⑥ 校验+渲染 | `src/report.js` | 把模型返回抠成合法 JSON、过滤脏数据、渲染成评论 |
| 总入口 | `cli.js` | 把上面串起来；`src/webhook-server.js` 是自动触发的进阶脚手架 |

## 1. 测试

环境要求：Node.js ≥ 18（你已装 v22）。在本目录执行：

```bash
node cli.js --diff examples/buggy.diff --title "新闻列表实时刷新"
```

你会看到一份分级评审报告（blocker/major/minor），同时写入 `review-output.md`。
`examples/buggy.diff` 是一段故意埋了坑的 React 代码：裸写 fetch、缺 catch、`dangerouslySetInnerHTML`、`key=index`、定时器没清理。

> 离线时走的是 `llm.js` 里的 **mock（模拟）评审**，只用几条固定规则演示"输出长什么样"；真正聪明的逻辑要接真实模型。

## 2. 接入真实模型（第一次让 AI 真的思考）

所有主流模型都兼容同一套 OpenAI 接口，只要改三个环境变量：

```bash
# 以 DeepSeek 为例
export LLM_BASE_URL=https://api.deepseek.com/v1
export LLM_API_KEY=你的key
export LLM_MODEL=deepseek-chat

node cli.js --diff examples/buggy.diff --live
```

- `--live` 才会真的发请求；不加就永远走 mock，方便反复调试。
- 密钥只放环境变量，**绝不写进代码、绝不提交 git**（见 `.env.example`）。
- 换成 OpenAI / Kimi / 通义 / OpenRouter，只改上面三行。

## 3. 从"手动命令"到"PR 一提交自动评审"（webhook）

手动敲命令只是测试。真实自动化靠 **webhook（网络钩子）**：在 GitHub/GitLab 后台填一个你的服务地址，每当有人建 PR 或 push，平台就主动给你发一个 POST 请求，触发评审。

- 骨架已写好：`src/webhook-server.js`，本地可 `node src/webhook-server.js` 启动。
- 上线前自己补两个 TODO：①校验请求签名防伪造；②用 token 拉取 PR 的 diff、再把评论发回 PR。
- 更省事的替代：不用自己起服务，直接用 **GitHub Action**（配置一个 yaml，在 PR 事件里跑 `cli.js`），第 4 节给了方向。

## 4. 下一步升级路线

1. **把规范库养起来**：往 `docs/` 多放 ADR 架构决策、踩坑记录，RAG 越喂越准。
2. **升级向量 RAG**：引入 embedding + 一个轻量向量库（如 Qdrant），替换 `rag.js` 里的 `retrieve()`，其它文件不动。
3. **分级模型省钱**：小模型先分诊，只把安全/复杂逻辑送给强模型。
4. **接 GitHub Action**：PR 事件自动跑，评论自动回写。
5. **反馈回流**：把人"采纳/驳回"的意见沉淀回知识库，持续降噪。

## 6. 两条红线

- **AI 只提建议，永远不自动合并、不直接改主分支**，最终拍板是人。
- **格式/ lint 问题交给现成工具**（ESLint 等）；LLM 只查逻辑、边界、设计这些静态工具查不出的问题。
