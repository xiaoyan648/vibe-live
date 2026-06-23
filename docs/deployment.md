# Vibe Live 部署指南

将 Next.js 应用部署到阿里云 ECS，通过 **IP + 端口** 直接访问。

## 前置条件

| 项目 | 说明 |
|------|------|
| 本地 | macOS/Linux，已安装 `rsync`、`ssh` |
| 服务器 | 阿里云 ECS，已绑定公网 IP |
| SSH 密钥 | `~/.ssh/flowmore.pem`（或自定义路径） |
| 安全组 | 入方向放行应用端口（本服务器用 `3001`，因 `3000` 已被 Docker 占用） |

### 阿里云安全组

在 ECS 控制台 → **安全组** → **入方向规则**，添加：

| 协议 | 端口 | 源地址 | 说明 |
|------|------|--------|------|
| TCP | 3001 | 0.0.0.0/0 | 应用访问端口 |

> 生产环境建议将源地址限制为固定 IP 段。

## 服务器信息

```bash
REMOTE_HOST=101.132.167.228
REMOTE_USER=root
DEPLOY_SSH_KEY=~/.ssh/flowmore.pem
```

验证 SSH 连通：

```bash
ssh -i ~/.ssh/flowmore.pem root@101.132.167.228
```

## 首次部署

### 1. 配置服务器环境变量（本地）

```bash
export REMOTE_HOST=101.132.167.228
export REMOTE_USER=root
export DEPLOY_SSH_KEY=~/.ssh/flowmore.pem
```

也可写入 `~/.zshrc` 或项目根目录 `.env.deploy`（勿提交到 Git）：

```bash
# .env.deploy — 仅本地使用，不要 commit
REMOTE_HOST=101.132.167.228
REMOTE_USER=root
DEPLOY_SSH_KEY=~/.ssh/flowmore.pem
APP_PORT=3001
```

### 2. 在服务器上创建 `.env`

应用支持在首页 `AI 配置` 面板由用户填写 OpenAI 兼容 API Key、Base URL 与 Model，并保存在当前设备。服务器 `.env` 只是开发/部署默认值，**不会**随部署脚本自动上传（避免泄露）。

```bash
ssh -i ~/.ssh/flowmore.pem root@101.132.167.228

mkdir -p /opt/vibe-live
cat > /opt/vibe-live/.env <<'EOF'
OPENAI_API_KEY=你的-openai-compatible-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4.1-mini
OPENAI_IMAGE_MODEL=你的-openai-compatible-image-model
OPENAI_IMAGE_SIZE=1024x1024
OPENAI_IMAGE_RESPONSE_FORMAT=url
VIBELIVE_MAX_CONVERSATION_MESSAGES=8
NEXT_PUBLIC_VIBELIVE_MAX_CONVERSATION_MESSAGES=8
EOF
```

如果继续使用火山引擎 Ark，可以保留旧变量：`ARK_BASE_URL`、`ARK_API_KEY`、`ARK_MODEL`、`ARK_IMAGE_MODEL`、`ARK_IMAGE_SIZE`。参考本地 `.env.local.example`。

### 3. 首次部署（含服务器初始化）

```bash
chmod +x scripts/deploy.sh

# 安装 Node.js 20、PM2，并部署应用
./scripts/deploy.sh --bootstrap
```

`--bootstrap` 会在服务器上安装：

- Node.js 20（NodeSource）
- PM2（进程守护）
- 若 ufw 已启用，自动放行 `APP_PORT`

### 4. 访问

```
http://101.132.167.228:3001
```

## 日常更新

代码改动后，一条命令重新发布：

```bash
export REMOTE_HOST=101.132.167.228
./scripts/deploy.sh
```

脚本流程：

1. `rsync` 同步代码到 `/opt/vibe-live`（排除 `node_modules`、`.next`、`.env`）
2. 远程执行 `npm ci && npm run build`
3. `pm2 startOrReload` 无停机重启

仅同步依赖、跳过构建（紧急情况）：

```bash
./scripts/deploy.sh --skip-build
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `REMOTE_HOST` | — | **必填**，服务器 IP |
| `REMOTE_USER` | `root` | SSH 用户 |
| `DEPLOY_SSH_KEY` | `~/.ssh/flowmore.pem` | SSH 私钥路径 |
| `REMOTE_APP_DIR` | `/opt/vibe-live` | 远程应用目录 |
| `APP_PORT` | `3001` | 监听端口（本机 3000 已被 Docker 占用） |

修改端口示例：

```bash
APP_PORT=8080 ./scripts/deploy.sh
```

同时更新阿里云安全组入方向规则。

## 服务器运维

### 查看应用状态

```bash
ssh -i ~/.ssh/flowmore.pem root@101.132.167.228 "pm2 status"
```

### 查看日志

```bash
ssh -i ~/.ssh/flowmore.pem root@101.132.167.228 "pm2 logs vibe-live --lines 100"
```

### 手动重启

```bash
ssh -i ~/.ssh/flowmore.pem root@101.132.167.228 "pm2 restart vibe-live"
```

### 更新服务器 `.env` 后

```bash
ssh -i ~/.ssh/flowmore.pem root@101.132.167.228 "pm2 restart vibe-live --update-env"
```

## 目录结构（远程）

```
/opt/vibe-live/
├── .env                 # 服务器本地配置（手动创建，不随 rsync 同步）
├── deploy/
│   └── ecosystem.config.cjs   # PM2 配置
├── .next/               # 构建产物
├── node_modules/
└── ...
```

## 故障排查

### 无法访问 IP:端口

1. 检查安全组是否放行 `APP_PORT`
2. 检查服务器防火墙：`ufw status` 或 `firewall-cmd --list-ports`
3. 确认进程在监听：`ss -tlnp | grep 3001`
4. 确认 PM2 状态：`pm2 status`

### 构建失败

```bash
ssh -i ~/.ssh/flowmore.pem root@101.132.167.228
cd /opt/vibe-live
npm ci
npm run build
```

查看具体报错。

### AI 生成失败

检查服务器 `/opt/vibe-live/.env` 中 `OPENAI_API_KEY`、`OPENAI_MODEL`、`OPENAI_BASE_URL` 是否正确；如果使用 Ark，则检查 `ARK_API_KEY`、`ARK_MODEL`。更新后执行：

```bash
pm2 restart vibe-live --update-env
```

## 与现有 Nginx 服务共存

服务器上若已有 flowdraft 等站点（`flowdraft.cn` → 静态前端，`/api` → `127.0.0.1:8080`），**不会自动冲突**，前提是：

| 资源 | flowdraft（现有） | vibe-live（本应用） |
|------|-------------------|---------------------|
| 80 / 443 | Nginx 占用 | 不直接监听，走 Nginx 反代或另开端口 |
| 8080 | 后端 API | **不要用**，会冲突 |
| 3000 | Docker 占用（127.0.0.1） | **不要用** |
| 3001 | vibe-live | 本服务器推荐端口 |

vibe-live 是 **Next.js 全栈应用**：页面和 `/api/generate` 都在同一个进程里，不像 flowdraft 那样前后端分离。因此反代时要把**整站**指到 3001，不能把 `/api` 再拆到 8080。

### 方案 A：IP + 端口（最简单，零改动现有 Nginx）

```
http://101.132.167.228:3001
```

- 现有 `flowdraft.cn` 配置**完全不用动**
- 只需安全组放行 3001
- 缺点：无 HTTPS、无域名

### 方案 B：子域名 + Nginx 反代（推荐长期方案）

例如 `vibe.flowdraft.cn`，新增独立 `server` 块，与 flowdraft 并列：

```nginx
# /etc/nginx/sites-available/vibe-live
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name vibe.flowdraft.cn;

    ssl_certificate     /etc/letsencrypt/live/vibe.flowdraft.cn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vibe.flowdraft.cn/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 流式生成（/api/generate/stream）
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
    }

    client_max_body_size 20m;

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/json application/javascript;
}

server {
    listen 80;
    listen [::]:80;
    server_name vibe.flowdraft.cn;
    return 301 https://$host$request_uri;
}
```

申请证书并启用：

```bash
certbot certonly --nginx -d vibe.flowdraft.cn
ln -s /etc/nginx/sites-available/vibe-live /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

此时 3001 只需本机访问，**安全组不必对公网开放 3001**。

### 不要做的事

- 不要把 vibe-live 绑到 **8080**（flowdraft 后端已占用）
- 不要改 flowdraft 的 `location /api` 指向 3001（会破坏 flowdraft）
- 不要用 `default_server` 抢 flowdraft 的 80 端口

## 可选：绑定域名 + HTTPS

若已有 Nginx + Certbot，优先用上方**方案 B（子域名）**。无子域名时，也可为独立域名新建 `server` 块，`proxy_pass http://127.0.0.1:3001` 即可。
