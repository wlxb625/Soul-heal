# 愈格 · Personality Improvement Suite

愈格是一个围绕 MBTI 测试、性格分析、AI 改进建议、计划簿执行与成长追踪的 Web 项目。

当前上线方案：

- **Netlify** 托管前端静态站点
- **Supabase Auth** 负责邮箱/密码注册登录
- **Supabase Postgres** 保存每个用户的应用状态
- 用户在设置页填写自己的 AI API Key 和模型名称

这个版本不需要 Render，也不需要银行卡。

## 功能

- 邮箱注册 / 登录
- 注册密码强度校验
- MBTI 56 题测试
- 16 型人格手动选择
- 性格分析与雷达图
- AI 改进建议与结构化计划
- 计划簿、任务打钩、达成阈值与进度展示
- 深浅色模式
- 自定义 API Base URL、API Key、模型名称

## 项目结构

```text
personality-improvement-suite/
├─ index.html
├─ styles.css
├─ app.chat.js
├─ common.runtime.js
├─ runtime-config.js
├─ netlify.toml
├─ scripts/
│  └─ build-netlify.js
├─ supabase/
│  └─ schema.sql
└─ test/
   ├─ regression.test.js
   └─ split-deploy.test.js
```

## 本地运行

```bash
npm install
npm start
```

然后打开：

```text
http://localhost:3000
```

本地不配置 Supabase 时，页面会继续访问同源后端，方便开发调试。

## Supabase 配置

1. 创建 Supabase 项目。
2. 打开 Supabase SQL Editor。
3. 执行 [supabase/schema.sql](./supabase/schema.sql)。
4. 到 Project Settings -> API，复制：
   - Project URL
   - anon public key

`app_states` 表启用了 RLS，每个用户只能读取和更新自己的状态。

## Netlify 配置

Netlify 构建配置在 [netlify.toml](./netlify.toml)。

需要在 Netlify 项目里设置环境变量：

```text
YUGE_SUPABASE_URL=https://你的项目.supabase.co
YUGE_SUPABASE_ANON_KEY=你的 Supabase anon public key
```

构建命令：

```bash
node scripts/build-netlify.js
```

发布目录：

```text
dist
```

构建脚本只会把前端必需文件复制到 `dist/`，并生成 `runtime-config.js`。

## AI 设置

进入网站后：

1. 登录账号
2. 进入“设置”
3. 填写服务商、Base URL、API Key、模型名称
4. 保存后回到“AI 助手”

注意：当前 Supabase 版本仍是用户自带 API Key 模式。API Key 会随用户状态保存到 Supabase。更严格的生产方案应改为 Netlify Function 或 Supabase Edge Function 代理 AI 请求，避免在浏览器侧直接处理密钥。

## 验证

```bash
npm test
node --check common.runtime.js
node --check app.chat.js
node --check scripts/build-netlify.js
```
