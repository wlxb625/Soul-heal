# 愈格 · GitHub Pages 静态版

一个可直接部署到 **GitHub Pages** 的前端静态项目，用来做 MBTI 测试、性格分析、AI 改进建议与计划簿跟踪。

这个版本不依赖后端服务，适合：

- GitHub 作品展示
- 课程作业 / 实验项目
- 个人静态网站
- 想快速复刻并二次开发的人

## 在线方式

上传到 GitHub 后，可以直接用 GitHub Pages 发布静态网址。

## 功能

- 邮箱 + 验证码 + 密码风险提示的本地注册登录
- MBTI 56 题测试
- 16 型人格手动选择
- 性格分析与雷达图
- AI 对话式建议
- AI 结构化计划生成
- 计划簿、打钩完成、达成阈值与成就展示
- 深浅色模式

## 项目结构

```text
soul-heal-pages/
├─ index.html
├─ styles.css
├─ app.chat.js
├─ common.runtime.js
├─ common.static.js
├─ .nojekyll
└─ README.md
```

说明：

- `index.html`：页面入口
- `styles.css`：样式文件
- `app.chat.js`：主要交互逻辑
- `common.runtime.js`：原项目通用能力和题库
- `common.static.js`：静态版适配层，负责本地存储、静态登录和前端直连 API

## 如何在自己电脑上复刻

### 方式一：直接下载 ZIP

1. 打开这个仓库
2. 点击 `Code`
3. 点击 `Download ZIP`
4. 解压到本地

### 方式二：使用 Git 克隆

```bash
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名
```

## 如何在自己电脑上运行

这是一个静态项目，推荐用本地静态服务器启动。

### 方法一：使用 VS Code Live Server

1. 用 VS Code 打开项目
2. 安装 `Live Server` 插件
3. 右键 [index.html](./index.html)
4. 选择 `Open with Live Server`

### 方法二：使用 Node 启动静态服务

如果电脑装了 Node.js，可以在项目目录执行：

```bash
npx serve .
```

或者：

```bash
npx http-server .
```

启动后在浏览器打开命令行里显示的本地地址。

## 如何上传到 GitHub Pages

### 方式一：直接把当前仓库作为 Pages 仓库

1. 把本项目上传到 GitHub
2. 打开仓库 `Settings`
3. 进入 `Pages`
4. 在 `Build and deployment` 里选择：
   - `Deploy from a branch`
5. Branch 选择：
   - `main`
6. Folder 选择：
   - `/ (root)`
7. 保存

稍等几分钟后，GitHub 会生成类似下面的网址：

```text
https://你的用户名.github.io/仓库名/
```

### 方式二：放到已有仓库的 `docs/` 目录

如果你已经有一个仓库，也可以把这套文件放到 `docs/` 目录，然后在 GitHub Pages 里选择：

- Branch：`main`
- Folder：`/docs`

## 如何使用 AI 功能

1. 打开网站
2. 注册本地账号
3. 进入“设置”
4. 填写你自己的：
   - `Base URL`
   - `API Key`
   - `模型名称`
5. 回到“AI 助手”开始使用

## 需要注意的地方

- 这是静态版，数据保存在浏览器 `localStorage`
- 更换浏览器或清空浏览器数据后，账号和记录会丢失
- 用户填写的 API Key 也是保存在当前浏览器本地
- 某些 AI 服务如果不支持浏览器跨域请求，静态版可能无法直接调用
- “邮箱验证码”目前是静态演示模式，会在页面提示验证码；如果要真实发邮件，需要额外接后端或邮件服务

## 二次开发建议

如果你想继续扩展，可以优先改这些文件：

- [index.html](./index.html)
- [styles.css](./styles.css)
- [app.chat.js](./app.chat.js)
- [common.static.js](./common.static.js)

如果你需要完整后端版，可以参考原始项目的 Node.js + Express + SQLite 实现。
# Soul-heal
