# 愈格 · AI Personality Coach

愈格是一个帮助用户理解人格倾向、获得 AI 建议并把建议落实为行动的个人成长 Web 应用。

线上体验：[yuge-personality-suite.netlify.app](https://yuge-personality-suite.netlify.app)

## 能做什么

### 1. MBTI 人格探索

- 提供 56 题 MBTI 正式测试，作答进度自动保存。
- 支持从人格引导场景进入答题工作台；在减弱动态模式下直接进入题目，保证可访问性。
- 已完成测试会生成类型、信度与匹配度；也可以随时重新测试。
- 已有结果的用户可直接选择 16 型人格，立即同步到其他模块。

### 2. 性格画像与成长参考

- 根据 MBTI 输出性格概览、优势、可提升方向与相处建议。
- 以雷达图和具体文字说明呈现人格特征，不把类型当作能力评判。
- 首页会汇总当前人格、行动进度与 AI 对话入口。

### 3. AI 结构化计划助手

- 用户可以围绕目标、困扰或场景与 AI 对话。
- AI 会结合人格类型、当前场景和历史对话给出更贴近用户的建议。
- 建议可整理为分组行动计划，直接加入计划簿持续推进。

### 4. 计划簿与进度激励

- 计划支持任务勾选、完成阈值、进行中/已达成统计与成长进度。
- 首页使用动态场景呈现今日聚焦与计划概览；随滚动切换为紧凑的行动入口。
- 提供连续打卡、徽章和活动记录，帮助把一次建议变成持续行动。

### 5. 登录与个性化体验

- 支持邮箱注册、登录、密码校验和验证提醒。
- 登录页使用双状态星环场景：晨景与夜景通过交互切换，但表单始终保持清晰可用。
- 支持浅色 / 深色主题，并兼顾深色模式下的文字对比度。
- 可在设置中配置 OpenAI 兼容接口、模型名称和个人偏好。

## 页面模块

| 模块 | 作用 |
| --- | --- |
| 首页 | 今日聚焦、人格概览、AI 入口与计划进度 |
| MBTI 测试 | 56 题测试、已有类型录入、测试结果管理 |
| 性格分析 | 类型画像、优势、成长方向与相处建议 |
| AI 助手 | 目标对话、结构化建议与计划生成 |
| 进度激励 | 计划统计、打卡、徽章与成长记录 |
| 设置 | 主题、人格类型、AI 服务与账号偏好 |

## 技术与数据

- 前端：原生 HTML、CSS、JavaScript 单页应用。
- 认证与数据：Supabase Auth + Postgres，使用 RLS 隔离用户数据。
- AI：浏览器通过 Netlify Function 调用 OpenAI 兼容服务，不直接暴露服务端密钥。
- 部署：Netlify 构建静态前端并提供 AI 代理函数。

## 本地运行

要求 Node.js 24。

```bash
npm install
npm start
```

默认访问地址：

```text
http://localhost:3000
```

未配置 Supabase 时，仍可通过本地 `server.js` 调试基础前端流程。

## Supabase 配置

1. 创建 Supabase 项目并执行 `supabase/schema.sql`。
2. 在 Netlify 环境变量中配置：

```text
YUGE_SUPABASE_URL=https://your-project.supabase.co
YUGE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

`app_states` 已启用 RLS，每位用户只能读取和更新自己的应用状态。

## AI 服务配置

登录后进入“设置”，填写可从公网访问的 OpenAI 兼容接口：

```text
Base URL：https://你的公网模型接口/v1
模型名称：要使用的模型名称
API Key：模型服务 API Key
```

不要为线上站点配置 `127.0.0.1`、`localhost` 或局域网地址；Netlify 无法访问个人电脑上的服务。

## 验证与构建

```bash
npm test
node scripts/build-netlify.js
```

构建产物位于 `dist`，Netlify 配置见 `netlify.toml`。
