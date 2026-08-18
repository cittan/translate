# AI 整页翻译 (DeepSeek)

一个油猴（Tampermonkey）脚本：在浏览器里一键翻译当前页面的外文为中文，原文与译文并排展示。基于 TypeScript + Vite + [`vite-plugin-monkey`](https://github.com/lisonge/vite-plugin-monkey) 构建，**桌面 / Android / iOS 跨端可用**。

## 特性

- **整页一键翻译**：自动提取页面外文文本节点（跳过 script/style/code/button 等），批量调用 DeepSeek 翻译
- **并排展示**：原文 + 译文同面板对照，移动端友好可拖动
- **跨端**：单一 `.user.js` 文件，桌面/Android/iOS Tampermonkey 通用
- **API Key 持久化**：通过油猴菜单输入，存储在 GM storage，不写入 git
- **批量 + 缓存**：一次请求翻译多条；同会话内同段不重复请求
- **降级容错**：批量失败时自动降级为逐条翻译

## 安装

### 1. 安装油猴扩展

| 平台 | 浏览器 | 扩展 |
|------|--------|------|
| 桌面 | Chrome / Edge / Firefox | [Tampermonkey](https://www.tampermonkey.net/) |
| Android | Firefox / Kiwi Browser | Tampermonkey |
| iOS | Safari | App Store 搜索 "Userscripts" |

### 2. 安装脚本

两种方式任选其一：

**A. 直接安装构建产物**

1. 仓库根目录的 `dist/ai-page-translator.user.js` 即为成品
2. 复制内容到 Tampermonkey → "添加新脚本" → 粘贴 → 保存

**B. 从源码构建**

```bash
git clone https://github.com/cittan/translate.git
cd translate
npm install
npm run build
# 产物：dist/ai-page-translator.user.js
```

**C. 开发模式（热更新）**

```bash
npm run dev
# 控制台会打印一个 .user.js 的 localhost URL，
# 在 Tampermonkey 中导入该 URL 即可，后续源码改动自动同步
```

### 3. 配置 DeepSeek API Key

1. 在 [DeepSeek 开放平台](https://platform.deepseek.com/) 申请 API Key（`sk-` 开头）
2. 打开任意网页，点击浏览器工具栏的 Tampermonkey 图标
3. 在脚本菜单中点击 **「🔑 设置 DeepSeek API Key」**，粘贴 Key
4. （可选）**「🛠 设置模型」** 切换 `deepseek-chat` / `deepseek-reasoner`

## 使用

1. 打开任意含外文的网页
2. 点击页面右下角的悬浮按钮「文」，或通过油猴菜单点击 **「🔍 翻译当前页面」**
3. 弹出面板，显示翻译进度；完成后原文与译文并排展示
4. 失败时面板显示错误信息，可关闭后重新触发重试

## 工作原理

```
[页面 DOM]
   │ extract.ts (TreeWalker + isForeign 判定)
   ▼
[ExtractedText[]]  ← 节点打 data-ai-tr-id 标记
   │ translator.ts (GM_xmlhttpRequest 批量调用 DeepSeek)
   ▼
[TranslateResult[]]
   │ ui.ts (右下角浮层，原文/译文并排)
   ▼
[用户可见译文]
```

判定外文规则：拉丁字母数 > CJK 字符数，且至少含一个 ≥2 字母的英文单词。避免在中文页面误译。

## 限制与注意

- 移动版 Chrome 不支持扩展，需用 Firefox / Kiwi Browser
- iOS Userscripts 应用的脚本运行环境与桌面 Tampermonkey 略有差异，如遇问题优先在桌面验证
- API Key 存储在油猴脚本管理器本地，不会上传到任何服务器
- 翻译缓存仅在当前页面会话内有效，刷新页面会重新请求
- DeepSeek 免费额度有限，长页面（数百条文本）可能产生费用

## 项目结构

```
translate/
├─ src/
│  ├─ meta.ts          # 油猴元数据（@match/@grant/@connect）
│  ├─ config.ts        # API Key / 模型 / 目标语言持久化
│  ├─ extract.ts       # TreeWalker 提取外文文本节点
│  ├─ translator.ts    # DeepSeek 批量翻译 + 缓存 + 降级
│  ├─ ui.ts            # 右下角浮层（FAB + 可拖动面板）
│  └─ main.ts          # 入口：菜单注册 + 翻译流程编排
├─ vite.config.ts
├─ tsconfig.json
└─ package.json
```

## 开发

```bash
npm install      # 装依赖
npm run dev      # 开发模式（热更新）
npm run build    # 生产构建，产出 dist/ai-page-translator.user.js
```

## License

MIT
