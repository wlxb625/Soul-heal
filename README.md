# 愈格 GitHub Pages 静态版

这是一个适配 **GitHub Pages** 的静态版本目录，来源于原项目 `personality-improvement-suite`，目标是让你可以把它直接上传到 GitHub，并通过静态网址访问。

## 目录位置

```text
g:\JAVASCRIPT\soul-heal-pages
```

## 这个版本和原版的区别

原版依赖：

- Node.js + Express
- SQLite
- 登录会话
- 服务端 API

所以不能直接跑在 GitHub Pages 上。

这个静态版已经改成：

- 页面仍然保留原有主界面风格
- 数据改为浏览器 `localStorage` 本地保存
- 注册 / 登录变成本地浏览器账号
- MBTI、计划簿、进度、成就都保存在当前浏览器中
- AI 助手改为前端直接调用用户自己填写的 API

## 适用场景

适合：

- 课程作业
- 个人作品展示
- GitHub 仓库展示
- 不想维护后端服务器的实验版本

不适合：

- 正式生产环境
- 多用户共享同一数据库
- 服务端安全保管 API Key

## 重要限制

### 1. 账号只是当前浏览器本地账号

静态版的注册和登录只保存在当前浏览器的 `localStorage` 里。

这意味着：

- 换浏览器后数据不会自动同步
- 清空浏览器数据后，账号和记录会丢失

### 2. API Key 会保存在浏览器本地

因为 GitHub Pages 没有后端，所以用户填写的 API Key 只能保存在浏览器本地。

这适合个人实验，但不适合正式商业项目。

### 3. 第三方模型接口需要支持浏览器跨域请求

静态版的 AI 助手会直接从浏览器请求模型接口。

如果某个服务商不允许浏览器跨域调用，AI 助手可能无法正常工作。

## 主要文件

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

其中：

- `common.runtime.js`：保留原项目的公共工具和题库
- `common.static.js`：覆盖后端接口，改成浏览器本地存储和前端直连 API
- `app.chat.js`：继续复用原来的主交互逻辑

## 如何上传到 GitHub

### 方式一：新建一个专门的 Pages 仓库

推荐直接新建一个新仓库，例如：

```text
Soul-heal-pages
```

然后把这个文件夹里的内容上传到仓库根目录。

本地命令示例：

```bash
cd g:\JAVASCRIPT\soul-heal-pages
git init
git add .
git commit -m "init github pages version"
git branch -M main
git remote add origin https://github.com/你的用户名/Soul-heal-pages.git
git push -u origin main
```

### 方式二：放进现有仓库的 `docs/` 目录

如果你想继续用现在的仓库，也可以把这个静态版目录内容放到仓库的 `docs/` 目录，然后在 GitHub Pages 里选择从 `main /docs` 发布。

## 如何开启 GitHub Pages

上传完成后：

1. 打开 GitHub 仓库页面
2. 进入 `Settings`
3. 找到 `Pages`
4. 在 `Build and deployment` 中选择：
   - `Deploy from a branch`
5. Branch 选：
   - `main`
6. Folder 选：
   - `/ (root)`
   - 如果你放在 `docs/`，就选 `/docs`
7. 保存

过一会儿 GitHub 会给你一个地址，通常类似：

```text
https://你的用户名.github.io/仓库名/
```

## 访问时的注意点

如果你仓库名不是用户名主页仓库，那么页面地址一般会带仓库名路径，例如：

```text
https://你的用户名.github.io/Soul-heal-pages/
```

这个版本已经使用相对路径资源和 hash 模块切换，适合 GitHub Pages 目录访问。

## 推荐使用方式

1. 先在页面里注册一个本地账号
2. 进入设置
3. 填入你自己的 API 配置
4. 再测试 AI 助手和计划簿功能

## 从原项目同步更新

如果你后面在原项目里继续改样式或交互，可以手动把这些文件同步过来：

- `public/index.html`
- `public/styles.css`
- `public/app.chat.js`

静态版特有的文件是：

- `common.static.js`
- `.nojekyll`
- 当前这份 `README.md`

## 建议

如果你只是想把项目放到 GitHub 上展示和实验，优先用这个静态版。

如果你后面想做真正可长期使用的完整网站，再继续使用原版：

- `Node.js + Express + SQLite`
- Render / Railway / 阿里云服务器
