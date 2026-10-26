// config.js —— 全局配置：把"可换的东西"都集中在这里，代码本身不用改
// 术语：环境变量 = 运行程序时从系统读进来的配置（比如 API 密钥），不写死在代码里，防止泄露。

export const config = {
  // 【模型】这里用 OpenAI 兼容接口。绝大多数国产模型（DeepSeek、通义、Kimi、OpenRouter 等）
  // 都兼容这个格式，只需要换 baseUrl、model、apiKey 三个值。
  llm: {
    // 不填或 MOCK=1 时走内置离线 mock，保证没 key 也能把整条流程跑通
    baseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    temperature: 0.2, // 越低越稳定、少发挥；评审任务建议 0~0.3
  },

  // 【RAG 开关】MVP 阶段用"规范文档关键词检索"代替向量库，先把概念跑通。
  // 想彻底跳过上下文检索就设 false。
  rag: {
    enabled: process.env.RAG_ENABLED !== 'false',
    docsDir: './docs', // 团队规范、架构约定都放这里，评审时被检索出来塞进 prompt
    topK: 3,          // 每次最多塞几段相关规范
  },

  // 【严重级别】对应 PR 评论里的分级，blocker 必须改才能合并
  severity: {
    blocker: '必须修复（阻塞合并）',
    major: '建议修复（重要问题）',
    minor: '可选优化（风格/小建议）',
  },

  // 【评审清单 checklist】
  checklist: [
    '是否有空值/undefined 未判空就直接使用（如 obj.xxx.a.b）',
    '异常/失败路径是否被处理（catch、错误提示、loading 复位）',
    '边界条件：空数组、空字符串、0、接口超时、并发重复点击',
    'React：是否有缺失的 useEffect 依赖、过期闭包、直接修改 state、key 使用 index',
    '安全：是否有 dangerouslySetInnerHTML、把用户输入拼进 href/innerHTML、硬编码密钥或 token',
    '性能：是否有不必要的重渲染、大列表未虚拟滚动、未做防抖节流、重复请求',
    '是否复用了项目已有工具函数/常量，而不是重复造轮子',
    '命名是否清晰，是否有注释说明复杂逻辑，是否补了关键分支测试',
  ],
};
