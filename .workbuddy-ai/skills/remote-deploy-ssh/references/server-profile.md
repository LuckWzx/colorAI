# 目标服务器档案（`118.31.10.161`，root）

> 从 `memory/MEMORY.md` 搬出来的**具体事实**（规则只留指针）。
> 最近一次全面实测：**2026-09-28**。数字会变，动手前先 `ssh_run.py` 复测。

## 1. 系统与工具链

| 项 | 值 |
|---|---|
| OS | Ubuntu 22.04.5 |
| Docker | 29.1.2 |
| compose | **`docker-compose` 1.29.2 与 `docker compose` 5.0.0 两套并存** |

两套都能解析本项目文件，**且都保住 `depends_on: condition: service_healthy`**。

## 2. 内存与容器（2026-09-28 实测）

**内存 1673 total / available 约 900MB ~ 1GB，swap 仍为 0。**

波动**全部**由 `WeKnora-neo4j`（407MB）的启停决定 —— 它**不是我们的容器，但直接决定我们有没有余量**。
演变记录：早前 ~210MB → 09-24 傍晚 845MB → 09-28 11:11 只有 613MB → 11:23 又回到 1031MB。

### 在跑

| 容器 | 内存 |
|---|---|
| `minio` | 107MB |
| `WeKnora-postgres` | 52MB |
| `colorai-agent` | 91.9MB |
| `colorai-go` | 7.9MB |
| `WeKnora-redis` | 4MB |
| `nginx-container`（blog 的） | 4MB |
| `colorai-nginx`（我们的） | 3MB |

### 已 Exited

`WeKnora-neo4j`（手动停）/ `WeKnora-app` / `WeKnora-frontend` / `WeKnora-docreader` /
`blog-app` / `mysql8.0`。

### 监听端口

80 / 5432 / 6379 / 9000-9001 / **8080** / 22（7474/7687 随 neo4j 停而消失）。

## 3. 🔑 Docker 重启策略的精确规则（栽过两次）

> **手动 `docker stop` 后，该容器的重启策略被忽略 —— 直到 daemon 重启或容器被手动 start。**

* 09-24 `docker stop` 掉 neo4j → 它一直不回来；
* **09-28 10:20 宿主机重启（daemon 重启）→ 策略重新生效 → neo4j 自己回来了**；
* 11:11 又被 `docker stop` → 现在保持 Exited。

**结论：`docker stop` 只能压到「下次 daemon 重启」为止。别指望它永久腾出内存。**

## 4. ⚠️ 判 OOM 看 `.State.OOMKilled`，别只看退出码

一度把 neo4j 的 `Exited (137)` 误判成 OOM kill —— **错了**：

```
ExitCode=137  且  OOMKilled=false   →  docker stop 发完 SIGTERM 等不到退出、再用 SIGKILL 补刀的典型签名
journalctl -k | grep oom-kill  →  0 条
```

📌 **这台机器至今没发生过真正的 OOM**（内核日志 0 条），说明还有余量。

## 5. 镜像 / 磁盘

| 项 | 值 |
|---|---|
| `alpine:3.20` | ✅ 本地已有（12.2MB）→ **Go 镜像构建完全不需要联网** |
| `python:3.11-slim` | ❌ 本地没有（`docker image inspect` 报 No such image）→ **agent 构建必须联网拉（约 45MB）** |
| 磁盘 `/` | 40G，30G used，**7.6G free** |
| `docker system df` Images | 20.86GB（**15GB 可回收**） |

⚠️ **`dangling` 镜像 = 0** —— 那 15GB 是「不再使用的**带标签**镜像」，**里面有别人的东西** →
**别乱跑 `docker image prune -a`**，要清先逐个确认。

## 6. 路径

| 用途 | 路径 |
|---|---|
| 后端部署目标 | `/home/www/project/colorAI` |
| 前端 dist 落地 | `/root/nginx/blog/colorai` |
| colorAI nginx 配置 | `/root/nginx/conf.d-colorai/colorai.conf` |
| blog nginx 配置 | `/root/nginx/conf.d/blog-nginx.conf` |

## 7. colorAI 的 nginx = 独立容器 `colorai-nginx`

生命周期脚本 `deploy/nginx_up.py`。

**为什么是独立容器**：用户只有一个域名 `wzx.glaty.cn`，已被 blog 占用 80，且 blog 前端**也**调 `/api`
→ 共用 80 必然抢 `location /api/`。
**换 `listen` 端口 = 换 server 块 = `/api` 天然隔离，前端代码零改动**
（它写死的 `/api` 在 8080 上照样落到我们块）。

端口不能热加 → 两条路：

* ❌ 重建 blog 的 `nginx-container`：blog 断 2~3s，且以后每次改 colorAI 的 nginx 都要再冒一次 blog 的风险；
* ✅ **新建独立 `colorai-nginx`（已采用）**：blog **零停机**、conf 与内容目录全独立、回滚一行 `docker rm -f colorai-nginx`。代价：多一个 nginx 进程（~6MB）。

### 容器形态（`nginx_up.py` 里就是这几条，改它别手敲）

```
-p 8080:80                                        # 容器内 listen 80
-v /root/nginx/conf.d-colorai:/etc/nginx/conf.d:ro
-v /root/nginx/blog/colorai:/usr/share/nginx/html/colorai:ro
--network colorai-net
```

### ⚠️ 两个 conf 目录长得像，务必分清

用户实际问过「`/root/nginx/conf.d` 里怎么没有 colorai.conf」—— **它就是不在那儿**：

| 宿主目录 | 挂进谁 | 里面只有 |
|---|---|---|
| `/root/nginx/conf.d/` | `nginx-container`(blog) | `blog-nginx.conf` |
| `/root/nginx/conf.d-colorai/` | `colorai-nginx`(我们的) | `colorai.conf` |

**不能**把 colorai.conf 放进 `/root/nginx/conf.d`：那个目录也挂进了 blog 容器，而它同样是
`listen 80; server_name wzx.glaty.cn;` → 撞同名 server_name，nginx 只取文件名字母序靠前的
（`blog-nginx.conf` 在前），我们的块在 blog 里成死配置。
**分开目录正是「blog 零停机」的来源。**

改配置流程：改仓库 `deploy/nginx/colorai.conf` → `nginx_up.py --apply`；
**别在服务器上直接改**（会和仓库漂移）。`--verify` 会把两个目录内容都列出来对照。

### ✅ 2026-09-24 实测

容器 `Up` / `8080->80` / 首页·`manifest.webmanifest`·`/assets/*.js` 全 **200** / `nginx -t` ok /
**blog 首页 200、后台 301 与基线一致（零影响）**。

⚠️ 云控制台**安全组必须放行 8080/tcp** —— 服务器本机 `curl 127.0.0.1:8080` 通 ≠ 外网通。
（2026-09-28 实测：**本来就放行了**。）

ℹ️ 概念澄清：**一个 nginx 能托管无限个网站**（server 块数量不限，按 `server_name`/`listen` 端口/
`location` 路径区分）。上面的限制**完全来自「容器挂了哪些目录」**，与 nginx 自身能力无关 ——
别混成「一个 nginx 只能一个网站」。

### blog 基线（任何操作后应一致）

`blog首页 200` / `blog后台 301` / 挂载 2 条 / 网络 `blog-net`。
**`blog-api` 现在就是坏的** —— `blog-app` 实测 `Exited (2)` 已两个月，别算到我们头上。

### 🔴 `docker run` 是「重建容器」不是「往原容器上加东西」

挂载/网络**不累积、不继承** → 「加新挂载会不会让 blog 失效」→ **不会，只要原来那两条挂载原样再写一遍**；
出事的不是「多写」而是「漏写」。三个漏不得的参数：

1. `-v /root/nginx/blog:...`（漏了 blog 全 404，一眼可见）
2. `-v /root/nginx/conf.d:...`（漏了只剩欢迎页，一眼可见）
3. **`--network blog-net`（漏了静态页照样 200，只有 `/api/` 和 `/files/` 挂 —— 最难查）**

**数据永不丢**（`/root/nginx/blog` 是宿主目录）。
→ 真要动 blog 容器时，用 `python deploy/nginx_up.py --blog-rebuild` **现场推导**等价命令（别手抄）。

### 🔴 推 dist 的真实风险：`rsync --delete` 目标写错

📌 dist 放 `/root/nginx/blog/colorai/`，用 `deploy/upload_dist.py` 推。
真实风险**不是**「文件互相覆盖」（不同子目录），而是目标写错：
`... --delete dist/ /root/nginx/blog/`（**漏了 `/colorai`**）会把 blog 的 `front/` 和 `admin/` **全删掉**。

→ 已用 `assert_safe_target` 写成**硬校验**（目标必须正好是 `/root/nginx/blog/<站点名>`，
且拒绝叶子名 `front`/`admin`/`blog`，`--force` 才可绕过），四种错误写法实测全被拦。
本机**没有 `rsync`**，所以脚本是唯一可行路径。

⚠️ **`docker cp` 把 dist 拷进容器**看似能同时避开「污染宿主」和「重建容器」，**但有坑**：
容器一重建内容就没了 → 别用。

## 8. 🔴 Git Bash 的 MSYS 路径转换

以 `/` 开头的**命令行参数**会被改写成 Windows 绝对路径。实测：

```
python x.py --remote-dir /root/nginx/blog
→ 程序收到 C:/Users/魏正想/.workbuddy-ai/binaries/PortableGit/versions/.../root/nginx/blog
```

`check_msys_mangling()` 已挡（在 `upload_backend.py`，供其余脚本 import）。
**默认值可用就别传 `--remote-dir`**；要传加 `MSYS_NO_PATHCONV=1`；`--arg=值` 写法**躲不过**（实测）。

## 9. 同机通信（hairpin NAT）

`Redis` / `PG` 就在这台机器的 Docker 容器里 → **容器内连公网 IP `118.31.10.161` 一定 FAIL**。
实测可用：`172.17.0.1:5432`、`host.docker.internal:5432`（**在 `colorai-net` 上同样可用**）。
MySQL `39.106.186.3` 是**另一台机器**，公网可达。

## 10. 🎉 部署成功记录（2026-09-28 11:33）

命令 `<py> deploy/backend_up.py`（= 服务器上
`docker-compose -f docker-compose.yml -f docker-compose.offline.yml up -d --build`），耗时 **4 分 43 秒**。

| 项 | 值 |
|---|---|
| `colorai_go-backend:latest` | **52.2MB** |
| `colorai_agent:latest` | **655MB**（旧的在线版 824MB —— 离线版不含 gcc 那 203MB 层，**减重 169MB**） |
| `colorai-go` | `127.0.0.1:3001->3001`，`restart=unless-stopped` |
| `colorai-agent` | `8000/tcp` 不对外，`restart=unless-stopped` → 两者**开机自启** |

### ✅ 全绿验证清单

* 公网 `http://wzx.glaty.cn:8080/api/health` → **200**；前端首页 → 200（1182B）
* **8080 安全组本来就放行了**（TCP 直连实测可达）
* **blog 的 80 端口仍 200，未受影响**
* `go → agent:8000/health` → 200（**colorai-net 服务名解析正常**）
* Go 日志：`Redis 连接成功` + `Go backend server ready on port 3001`
* agent 日志：`ColorAI Agent v1.0.0 启动中` + `Application startup complete`，无报错
* **MySQL 实测打通**：`POST /api/auth/login`（错凭据）→ 401 `该手机号尚未注册`，
  Go 日志里有真实 SQL：`SELECT * FROM users WHERE phone = ... [rows:0]`
  → **`users` 表存在**，证明表确实已建好、`DB_AUTO_MIGRATE=false` 正确
* `POST /api/chat` 无 token → **401**（鉴权中间件正常）
* 容器内探连通性：go→MySQL 3306 可达 / agent→PG 5432 可达 / agent→Redis 6379 可达

### 📌 内存实测远好于预期

`colorai-go` 仅 **7.9MB**、`colorai-agent` 仅 **91.9MB**（不是先前估的 300~600MB！），
宿主机 available 仍有 **901MB**。
→ 之前那个「agent 常驻 300~600MB」的估计**偏悲观**，**swap 的紧迫性大幅降低**（用户已决定暂不加）。

### ⚠️ 遗留小事

* Gin 启动打 `You trusted all proxies, this is NOT safe` 警告（既有代码配置，非本次引入）
* `CORS_ORIGINS` 里没有 `wzx.glaty.cn:8080`（同源，不影响）

## 11. 待办（未完成）

* **浏览器端 E2E 验收**：走 `deploy/部署清单.md` §9（`http://wzx.glaty.cn:8080/`），
  含鉴权流程与**一次真实图片上传往返**（会同时压 OSS / Go `resolveImages()` / `POST /api/chat`）。
* **`CORRECTION_API_URL` 仍未与接口提供方确认** —— 验收若校色失败先查它（见 MEMORY 规则 34）。
* 可选：**加 2GB swap**（用户说「现在先不加」，且 agent 只用 91.9MB → 不急）。
* 可选：**`colorai-nginx` 上 HTTPS**（`-p 8443:443`）—— 注意 Service Worker/PWA 只在 HTTPS 下注册。
* 用户动作：**轮换服务器 root 密码**；**轮换 OSS AK/SK**。
* 真实 `docker-compose up -d --build` **在线路径至今从未跑过**（一直走离线路径）。

## 12. 部署硬规则（compose / nginx / 镜像 / 目录）

> 从 `memory/MEMORY.md` 搬来的展开说明 —— 那边只留一行规则 + 指针，**为什么**在这里。

### 编排与文件

* **前端不容器化**（用户 2026-09-24 拍板）：dist 交给**独立容器 `colorai-nginx`**（见 §7），
  顶层 `docker-compose.yml` 只编排 `go-backend` + `agent`。
  曾写过「前端也容器化」方案（`ColorAI/Dockerfile` + `.dockerignore` + `nginx.conf`）**已删除**
  （备份 `D:/tmp/colorai-frontend-container-bak-*`）→ **别再往 `ColorAI/` 加 Dockerfile**。
* `go-backend/agent/docker-compose.yml` 只用于 **agent 单机调试**，与顶层编排 **`container_name` 同名**
  → **不要同时起**。
* **`AGENT_URL` 由 compose 的 `environment:` 注入 `http://agent:8000`，刻意不写进 `go-backend/.env`** ——
  那份文件**本地开发也在用**，写死服务名会让本地连不上 `127.0.0.1:8000`。
* **`go-backend/.dockerignore` 不能整体排除 `agent/`**：`main.go` import 的 `colorai-backend/agent`
  就是 `agent/manager.go`（**Go 包**），它与 Python 项目**共用目录名**。
  只能按子路径排除（`.venv`/`.env`/`app`/`scripts`/`doc`/`requirements.txt`/`Dockerfile`/compose）。
* **agent 的 CMD 是 `["python","-m","app.main"]`**，别硬编码 `--port 8000`
  —— 让 `settings.AGENT_PORT` 说话。

### nginx 反代（`deploy/nginx/colorai.conf`）

* **nginx 跑在容器里 → 两个容器必须共享网络**。顶层编排建**固定名**网络 `colorai-net`
  （`networks: colorai-net: name: colorai-net`；固定名是为了让外部 compose 能 `external: true` 引用）。
  nginx 按**服务名**直连：
  ```
  set $go_backend go-backend:3001;
  proxy_pass http://$go_backend$request_uri;
  ```
  **绝不能写 `127.0.0.1:3001`**（那是 nginx 容器自己）；也别指望 `172.17.0.1`
  （nginx 不在默认桥上就错）。
* ⚠️ **必须配 `resolver 127.0.0.11 valid=10s ipv6=off` + 变量** —— nginx **只在启动时解析一次上游**，
  go-backend 每次重建都换 IP，不重解析就表现为「**后端明明起着却一直 502**」。**这是最容易踩的坑。**
* Go 的 `ports: "127.0.0.1:3001:3001"` **只供宿主机 curl 排障**，nginx 不走它；agent 不映射端口。
* **`client_max_body_size 20m`**：图片走 base64 dataURL，`MAX_UPLOAD_BYTES=10MB` 是**解码后**字节数
  → 请求体 ≈13.7MB，默认 1m **必 413**。
  ⚠️ certbot 补的 443 server 块**不继承**该指令（只复制 `server_name`/`root`），**必须再写一遍**
  （否则 http 能传图、https 传图 413）。
  ⚠️ **`client_max_body_size` / `gzip` / 超时都是 per-server 的，不继承** —— 新站点必须自己再写一遍。
* 该文件还负责 `sw.js` / `registerSW.js` / `index.html` 的 **no-store** 与 SPA 回退 `/index.html`。
* 文件末尾附了「nginx 改回跑宿主机」时的替换写法。

### 目录纪律

* **`ColorAI/public/` 只放 PWA 资源，禁止放测试图**（2026-09-24 已清理）：
  `vite build` 会把 `public/` **原样复制进 `dist/`**，跟着 rsync 上传就变成
  `https://域名/uploads/xxx.jpg` **公开可访问**。
  当时那 5 张图：4 个死文件已删；`testimage.jpg` **是两个测试脚本的默认夹具**（差点误删），
  已移到 `go-backend/testdata/`（`agent/scripts/test_image_correction.py`、
  `scripts/test_chat_chain.py` 路径同步改过），并加进 `go-backend/.dockerignore`。
  → **以后往 `ColorAI/public/` 加东西前先想一遍：它会不会被公开发布？**
* **前端必须部署在域名根路径**：`vite.config.ts` 没设 `base`（默认 `/`），产物引用的是
  `/assets/...`、`/favicon.svg`、`/manifest.webmanifest` 等**绝对路径**。
  要放到子路径（如 `https://域名/colorai/`）必须先改 `base: '/colorai/'` 再重新构建，否则**全 404**。
  **Service Worker 只在 HTTPS 下注册**（或 localhost）—— 纯 HTTP 公网访问时 PWA 静默失效，页面本身不受影响。
* **前端字体依赖 Google Fonts**（`index.html` 引 `fonts.googleapis.com`），
  CSS 字体栈是 `Noto Sans SC, -apple-system, sans-serif`。
  **国内大概率加载不到 → 降级到系统字体**，页面不会坏、只是设计字体效果丢失。
* 前端浏览器侧用**相对 `/api`**（`src/services/api.ts`：`baseURL: isBrowser ? '/api' : ...`）
  → **换域名不需要重新 `npm run build`**。但必须部署在域名根目录。`ColorAI/` 下**没有** `.env`。

### 排障方向：CORS 基本无关，别往那查

Go 的 `middleware/cors.go` **从不 abort 非 OPTIONS 请求**，只在 Origin 命中白名单时**条件性**加
`Access-Control-Allow-Origin`；OPTIONS 一律 204。前端与 `/api` **同源**（同一个 nginx 出）
→ 浏览器根本不做 CORS 检查。`CORS_ORIGINS` 一旦设置就**整体覆盖默认值**。
`agent/.env` 的 `ALLOWED_ORIGINS` **与线上无关**（agent 只被 Go 在容器内网调用，浏览器不直连它）。
