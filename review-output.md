## 🤖 AI 代码评审（离线 mock 演示）

> 本次新增 14 行；AI 仅提供建议，最终是否采纳由人工决定。

**总评**：（离线 mock 模式）共扫描 1 个改动块，命中 7 条演示规则；接入真实模型后会给出更深入的逻辑与设计判断。

共 7 条意见：

### 1. 🔴 blocker · 必须修复 — `src/components/NewsList.jsx:19`
- **问题**：使用了 dangerouslySetInnerHTML 渲染内容，存在 XSS 风险
- **证据**：```js
<div dangerouslySetInnerHTML={{ __html: html }} />
```
- **建议**：改用安全渲染方式；确需富文本请先做白名单消毒。

### 2. 🟠 major · 建议修复 — `src/components/NewsList.jsx:8`
- **问题**：组件内裸写 fetch，未使用项目封装的 useRequest
- **证据**：```js
fetch('/api/news').then((res) => res.json()).then((data) => setNews(data));
```
- **建议**：统一改用 src/hooks/useRequest.ts，便于处理 loading 与错误。

### 3. 🟠 major · 建议修复 — `src/components/NewsList.jsx:8`
- **问题**：Promise 链路缺少 catch/finally，失败时 loading 不会复位
- **证据**：```js
fetch('/api/news').then((res) => res.json()).then((data) => setNews(data));
```
- **建议**：补充 .catch 并在 .finally 里关闭 loading。

### 4. 🟠 major · 建议修复 — `src/components/NewsList.jsx:9`
- **问题**：组件内裸写 fetch，未使用项目封装的 useRequest
- **证据**：```js
const timer = setInterval(() => { fetch('/api/news').then((r) => r.json()).then(setNews); }, 5000);
```
- **建议**：统一改用 src/hooks/useRequest.ts，便于处理 loading 与错误。

### 5. 🟠 major · 建议修复 — `src/components/NewsList.jsx:9`
- **问题**：Promise 链路缺少 catch/finally，失败时 loading 不会复位
- **证据**：```js
const timer = setInterval(() => { fetch('/api/news').then((r) => r.json()).then(setNews); }, 5000);
```
- **建议**：补充 .catch 并在 .finally 里关闭 loading。

### 6. 🟠 major · 建议修复 — `src/components/NewsList.jsx:22`
- **问题**：列表 key 使用 index，列表增删时可能造成渲染错乱
- **证据**：```js
<li key={index}>{item.title}</li>
```
- **建议**：使用稳定唯一 id 作为 key。

### 7. 🟡 minor · 可选优化 — `src/components/NewsList.jsx:9`
- **问题**：setInterval 需在 useEffect cleanup 中清理，避免内存泄漏
- **证据**：```js
const timer = setInterval(() => { fetch('/api/news').then((r) => r.json()).then(setNews); }, 5000);
```
- **建议**：在返回的清理函数里调用 clearInterval。
