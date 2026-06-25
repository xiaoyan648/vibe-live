# vibe-live
live coding with ai gen, 轻松获取想用的曲子

## macOS 客户端

VibeLive 可以打包成纯客户端 macOS 应用。打包后的应用从本地静态资源启动，不需要 Next.js server，也不会启动本地端口。AI 配置保存在用户本机浏览器存储里，当前支持 OpenAI 兼容接口：

- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`

在应用右上角打开 `AI 配置` 填写即可。背景图生成是一个独立的可选 tool，可以在同一个配置窗口里开启，并单独配置图片模型的 API Key、Base URL 和 Model；开启后，制作唱片弹窗会出现 `生成背景图 / 纯色背景` 切换。

### 从源码运行

```bash
npm install
npm run desktop:dev
```

### 生成 mac 安装包

```bash
npm install
npm run desktop:dist
```

构建产物会输出到 `release/`：

- `VibeLive-0.1.0-arm64.dmg`
- `VibeLive-0.1.0-arm64.zip`
- `mac-arm64/VibeLive.app`

当前本地构建没有 Apple Developer ID 签名。直接分发给用户时，首次打开可能需要右键应用选择“打开”，或在系统设置里允许打开。
