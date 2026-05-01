# 愈格 · AI Personality Coach

愈格是一个面向个人成长的 Web 应用，围绕 MBTI 测试、性格分析、AI 对话建议、结构化行动计划和计划簿执行形成闭环。

线上地址：[https://yuge-personality-suite.netlify.app](https://yuge-personality-suite.netlify.app)

当前部署方案：

- **Netlify**：托管前端静态页面，并运行 AI 代理函数
- **Supabase Auth**：邮箱注册、登录和会话管理
- **Supabase Postgres**：保存每个用户的测试结果、AI 会话、计划簿和设置
- **用户自带 AI Key**：在设置页填写公网 OpenAI 兼容接口和模型名称

项目不依赖 Render，也不需要银行卡。

## 主要功能

- 邮箱注册 / 登录
- 注册邮箱格式校验和密码强度校验
- MBTI 56 题测试
- 手动选择 16 型人格
- 性格分析、可信度、匹配度和雷达画像
- AI 助手读取性格特点、MBTI、当前场景和历史对话后给出建议
- AI 回复结构化计划，可加入计划簿
- 计划簿任务打钩、达成阈值、进度统计
- 深色 / 浅色主题
- 自定义 Base URL、API Key、模型名称

## 项目结构

```text
personality-improvement-suite/
├─ index.html                  # 单页应用入口
├─ app.chat.js                 # 页面交互、渲染和模块切换
├─ common.runtime.js           # Supabase 运行时、状态同步、AI 调用
├─ styles.css                  # 页面样式
├─ runtime-config.js           # 本地运行时配置占位文件
├─ server.js                   # 本地开发后端
├─ netlify.toml                # Netlify 构建、函数和路由配置
├─ netlify/functions/coach.js  # 线上 AI 代理函数
├─ scripts/build-netlify.js    # Netlify 构建脚本
├─ supabase/schema.sql         # Supabase 数据表和 RLS 策略
└─ test/                       # 回归测试
```

## 本地运行

要求 Node.js 24。

```bash
npm install
npm start
```

打开：

```text
http://localhost:3000
```

本地开发时可以使用 `.env.example` 作为参考配置。没有配置 Supabase 时，项目仍可通过本地 `server.js` 调试基础功能。

## Supabase 配置

1. 创建 Supabase 项目。
2. 打开 Supabase SQL Editor。
3. 执行 `supabase/schema.sql`。
4. 打开 Project Settings -> API，复制：
   - Project URL
   - anon public key
5. 在 Netlify 环境变量中填写：

```text
YUGE_SUPABASE_URL=https://your-project.supabase.co
YUGE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

`app_states` 表已启用 RLS，每个用户只能读取和更新自己的状态。

## Netlify 部署

Netlify 配置在 `netlify.toml`。

构建命令：

```bash
node scripts/build-netlify.js
```

发布目录：

```text
dist
```

线上 AI 请求通过 `/.netlify/functions/coach` 转发，浏览器不会直接请求模型厂商接口。

手动部署命令：

```bash
npx netlify deploy --prod --build
```

## AI 设置

登录后进入“设置”，填写公网 AI 接口信息：

```text
服务商：OpenAI 兼容接口
Base URL：https://你的公网模型接口/v1
模型名称：你要调用的模型名称
API Key：你的模型服务 API Key
```

不要把本地地址填到线上站点里，例如：

```text
http://127.0.0.1:8317/v1
```

Netlify 线上环境无法访问你电脑上的本地服务。

如果你本地用代理工具或本机模型服务测试成功，也不能直接把 `127.0.0.1`、`localhost` 或局域网地址填到线上站点。线上站点只能访问公网可达的 HTTPS/API 地址。

如果 AI 助手提示模型响应超时，通常不是 URL 填错，而是模型回复超过了 Netlify Function 的执行时间限制。可以换更快的模型，或改用执行时间更长的后端来代理 AI 请求。

## 验证

```bash
npm test
node --check common.runtime.js
node --check app.chat.js
node --check netlify/functions/coach.js
node --check scripts/build-netlify.js
```

## 常用命令

```bash
# 本地开发
npm start

# 跑测试
npm test

# 构建 Netlify 静态文件
node scripts/build-netlify.js

# 部署生产站
npx netlify deploy --prod --build
```
