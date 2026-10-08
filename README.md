# 曲泉AI (ColorAI)

> 基于 AI 大模型的色彩智能体，面向设计师、摄影师、印刷从业者及色彩爱好者，提供智能对话与图像处理功能。

核心价值：让色彩更精准，让专业色彩处理触手可及。

## 功能特性

> 当前版本聚焦**智能体问答模块**（AI 聊天工作台），首页等其余模块暂不在计划内。

| 功能 | 说明 | 路由 |
|------|------|------|
| AI 聊天工作台 | 与色彩智能体对话、会话历史管理，内置工具坞 | `/workspace` |
| 登录 / 注册 | 用户认证 | `/login` |

智能体侧当前注册了 **4 个工具**：图片一键校色、色彩知识问答（RAG 检索）、颜色数据查询、联网搜索。
后三个是自由输入工具，**没有工具坞入口** —— 直接在输入框提问即可（如「什么是莫兰迪色」「#A52A2A 适合什么场景」「2026 潘通年度色」）。

### 工作台工具坞

工具坞里的每一项都对应智能体侧的一个 Tool。**未实现的工具不会注册进智能体**
（`get_all_tools()` 只返回已实现的），前端同步置灰并打上「开发中」角标 ——
目的是不让智能体拿到编造的数据、包装成专业结论返回给用户。

| 工具 | 说明 | 状态 |
|------|------|------|
| 图片一键校正 | AI 智能白平衡还原真实色彩 | ✅ 已上线 |
| 智能取色器 | 点击图片获取多格式色值 | ⛔ 未实现 |
| 色彩空间转换 | HEX / RGB / CMYK / Lab 实时互转 | ⛔ 未实现 |
| 颜色相似度对比 | ΔE 专业色差量化评分 | ⛔ 未实现 |
| 手机拍摄校色 | 还原人眼视觉真实颜色 | ⛔ 未实现 |

> ⚠️ **工具坞是「已上线工具」的子集，不是全部。** `get_all_tools()` 另外还返回
> `color_knowledge_search`（色彩知识问答）、`color_lookup`（颜色数据查询）与
> `web_search`（联网搜索）——这三个走自由输入、由 LLM 按语义选择，没有对应的快捷按钮。
> 完整清单与各工具的数据来源见 [agent/README.md](go-backend/agent/README.md)。

功能是否可用的**唯一来源**是 `ColorAI/src/constants/workspace.ts` 的 `FEATURES[].available`：
后端实现并注册一个工具后，把对应项改成 `true`（同时补 `agent.py` 的 `FEATURE_TOOL_MAPPING`）
即可同时打开常驻工具坞和「全部工具」面板两处入口，不要在组件里另写判断。

## 技术栈

| 类别 | 技术 |
|------|------|
| **前端** | |
| 框架 | React 18 + TypeScript 5.8 |
| 构建 | Vite 6 |
| 样式 | Tailwind CSS 3.4 |
| 路由 | React Router DOM 7 |
| 状态管理 | Zustand 5 |
| PWA | vite-plugin-pwa |
| 图标 | Lucide React |
| **后端** | |
| 语言 | Go 1.24 |
| Web 框架 | Gin 1.10 |
| 数据库 | MySQL 8.0（GORM） |
| 缓存 | Redis 6+（go-redis v9） |
| 认证 | Redis Token 存储 |
| 对象存储 | 阿里云 OSS（可选，替代本地磁盘） |
| **AI 智能体** | |
| 框架 | LangGraph + FastAPI |
| LLM | DeepSeek API（`deepseek-flash`） |
| 联网搜索 | 博查 Web Search API（预付费，按次计费） |
| **知识库（RAG）** | |
| 嵌入模型 | BGE-M3（`BAAI/bge-m3`，1024 维，硅基流动 API） |
| 向量库 | PostgreSQL + pgvector（独立 schema `colorai_kb`） |
| 语料 | 1,320 文本块 + 310 色值 |
| 端口 | 8000 |

## 三层架构

```
前端 (React :5173) → Go 后端 (Gin :3001) → Python Agent (FastAPI :8000) → DeepSeek API
                                                                       └→ PostgreSQL (pgvector 知识库)
```

- **前端**：UI 渲染、用户交互
- **Go 后端**：用户认证、会话管理、数据库操作、代理转发
- **Python 智能体**：语义分析、工具选择、LLM 调用、工具执行、知识库检索

> 知识库用的 PostgreSQL 是 **agent 私有的**，Go 侧不访问它 —— Go 只做转发。

## 快速开始

### 环境要求

- Node.js 18+
- Go 1.24+（`go.mod` 声明 `go 1.24.0`，低于此版本会直接编译失败）
- Python 3.10+（用于智能体服务）
- MySQL 8.0+
- Redis 6+
- PostgreSQL 且已安装 **pgvector** 扩展（本项目实测于 PostgreSQL 17.9 + pgvector 0.8.1）
  —— **仅知识库问答需要**。不配也能正常启动，只是两个知识工具会返回「知识库功能未启用」，
  其余功能（对话、校色）不受影响。
- （可选）阿里云 OSS bucket —— **仅当 `STORAGE_DRIVER=oss` 时需要**，且 bucket 必须
  **允许匿名 `GetObject`**（public-read ACL 或 bucket policy 都行；后者更细粒度 ——
  只开 GetObject、不开 ListObjects，别人无法枚举文件列表）。
  原因：Python 侧的校色工具要 `httpx.get(image_url)` 下载图片，私有 bucket 会 403。
  默认 `local` 驱动写本地磁盘，不需要任何云服务。

### 安装依赖

```bash
# 前端
cd ColorAI
npm install

# 后端
cd ../go-backend
go mod tidy

# Python 智能体（必装：Go 后端启动时会自动拉起它）
cd agent
pip install -r requirements.txt
```

### 配置环境变量

```bash
cd go-backend
cp .env.example .env
```

编辑 `go-backend/.env`，填入实际值：

```env
# 服务端口
PORT=3001

# Python 智能体服务地址（必须与 agent/.env 的 AGENT_PORT 一致）
AGENT_URL=http://localhost:8000

# 数据库配置
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=your_db_user
DB_PASS=your_db_password
DB_NAME=your_db_name
DB_AUTO_MIGRATE=true

# Redis 配置
REDIS_ADDR=127.0.0.1:6379
REDIS_PASS=your_redis_password

# 图片存储：local（本地磁盘，默认）| oss（阿里云 OSS，bucket 公共读）
STORAGE_DRIVER=local
UPLOADS_DIR=uploads
# 图片对外访问 URL 前缀。**两种驱动语义不同，切驱动必须同步改**：
#   local → 站点基地址，实际 URL = 它 + /uploads/ + key
#   oss   → bucket 公网域名，实际 URL = 它 + / + key
PUBLIC_BASE_URL=http://localhost:3001
MAX_UPLOAD_BYTES=10485760

# 切 OSS 时填这四项（STORAGE_DRIVER=oss 时必填）
# OSS_ENDPOINT 在「ECS 与 bucket 同 region」时用内网域名，免公网流量费；本地开发用公网域名
# OSS_BUCKET=your-bucket
# OSS_ENDPOINT=oss-cn-hangzhou-internal.aliyuncs.com
# OSS_ACCESS_KEY_ID=your_access_key_id
# OSS_ACCESS_KEY_SECRET=your_access_key_secret

# 允许的前端来源（逗号分隔，可选）。不设时默认 localhost:5173 / localhost:3001；
# 一旦设置就会覆盖默认值，所以要连同默认两项一起写。
# 用局域网 IP 或手机访问时必须在这里加上对应来源，例如：
# CORS_ORIGINS=http://localhost:5173,http://localhost:3001,http://10.10.30.197:5173
```

> **LLM / 校色 / 知识库 / 联网搜索的密钥都不在 Go 侧。** Go 只做代理转发，实际调用方是 Python 智能体，
> 因此 DeepSeek Key 配在 `go-backend/agent/.env` 的 `DEEPSEEK_API_KEY`，校色服务地址配在
> `CORRECTION_API_URL`；知识库还需要 `EMBEDDING_API_KEY`（硅基流动）与 `PG_*` 连接信息；
> 联网搜索需要 `SEARCH_API_KEY`（博查，预付费需先充值）。
>
> 例外：**图片存储的凭据在 Go 侧**（`OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET`）——
> 因为解码落盘/上传是 Go 干的，Python 只拿到一个现成的图片 URL。

```bash
cd go-backend/agent
cp .env.example .env   # 填入 DEEPSEEK_API_KEY / EMBEDDING_API_KEY / PG_* 等
```

### 启动开发环境

只需启动 Go 后端，Python Agent 会自动随之启动：

```bash
# 终端 1: 编译并启动 Go 后端（会自动拉起 Python Agent）
cd go-backend
go build -o colorai-backend.exe .    # 先编译成真二进制
./colorai-backend.exe                # http://localhost:3001
```

```bash
# 终端 2: 启动前端
cd ColorAI
npm run dev          # http://localhost:5173
```

开发模式下 Vite 会将 `/api` 请求代理到 `http://localhost:3001`。

> **不要用 `go run main.go` 起服务。** `go run` 会另起一个编译后的子进程，
> kill 掉 `go run` 时那个子进程**不会退出**，3001 端口仍被占用；
> 下次启动会报 `bind: Only one usage of each socket address` 直接退出，
> 而你以为服务已经是新的了 —— 很容易误判成「改动没生效」。
>
> 另外**必须在 `go-backend/` 目录下启动**：Go 按当前工作目录去找 `agent/`。

## 知识库（RAG）

智能体的「色彩知识问答」与「颜色数据查询」由本地知识库支撑：
语料 → 切块 → BGE-M3 向量化 → PostgreSQL + pgvector（独立 schema `colorai_kb`）。

首次部署或改了 `agent/doc/` 下的语料后，需要初始化：

```bash
cd go-backend/agent

# 1. 建 schema + 三张表（幂等，可反复执行）
./.venv/Scripts/python.exe scripts/create_tables.py

# 2. 入库：解析 → 断言 → 向量化 → 全量重建
./.venv/Scripts/python.exe scripts/ingest_knowledge.py --dry-run   # 只解析+断言，0 成本
./.venv/Scripts/python.exe scripts/ingest_knowledge.py             # 正式入库
```

连接参数来自 `agent/.env` 的 `PG_*`。设计取舍（表结构、切块规则、检索阈值、
为什么不建 HNSW 索引、为什么色值查询不走向量）见
[RAG知识库设计.md](go-backend/agent/doc/RAG知识库设计.md)。

## 部署

> 📋 **照着做用 [`deploy/部署清单.md`](deploy/部署清单.md)** —— 10 步操作单，每步带「预期输出」与
> 「不对时查什么」，末尾附排障速查表。**本章讲为什么这么设计**，不重复操作步骤。

**后端两层用 Docker 编排，前端不打包成镜像** —— 静态产物由**一个独立的 Nginx 容器**托管。

> 为什么前端不打包成镜像：前端产物就是一堆静态文件，没有构建期逻辑，
> 打镜像只是多一层要维护的东西。
>
> 为什么**另起一个 nginx 容器**而不是塞进已有的那个：用户只有一个域名
> `wzx.glaty.cn`，已被 blog 占用 80，而 **blog 前端也调 `/api`** → 共用 80 必然抢
> `location /api/`。给 colorAI 单开 **8080**（换 `listen` 端口 = 换 server 块 = `/api`
> 天然隔离，**前端代码零改动**）。加端口必须重建容器，于是：
>
> - ❌ 重建 blog 的容器 → blog 断 2~3 秒，且以后每次改 colorAI 的 nginx 都要再冒一次风险
> - ✅ **新建独立 `colorai-nginx`** → blog **零停机**，conf 与内容目录全独立、
>   内容**只读**挂载，以后改 colorAI 的 nginx 完全不影响 blog，回滚一行命令
> - 代价：多一个 nginx 进程（实测 ~6MB）

```
浏览器 → colorai-nginx(:8080) ─┬→ /       → /root/nginx/blog/colorai  (dist，只读挂载)
   (独立容器，不碰 blog)         └→ /api/   → go-backend:3001    (走 colorai-net，按服务名直连)
                                                    ↓ colorai-net
                                              agent 容器(:8000，不对外暴露)
                                                    ↓
                          PostgreSQL+pgvector / DeepSeek / 硅基流动 / 校色接口
                             ↑ host.docker.internal（见下）

              Go 容器 ──直传──→ 阿里云 OSS ──图片 URL──→ agent 容器下载
              Go 容器 ──→ MySQL（在另一台机器） / Redis（本机容器）

   同时并存：blog 自己的 nginx-container(:80) → /root/nginx/blog/{front,admin}   ← 完全没动过
```

> ⚠️ **Redis 与 PostgreSQL 跑在同一台服务器的 Docker 容器里**（`WeKnora-redis` /
> `WeKnora-postgres`），只把端口发布到宿主机。**容器里不能用公网 IP 连它们** ——
> 2026-09-24 实测 `118.31.10.161:5432` 从容器内是 FAIL（宿主机不给自己做 hairpin NAT），
> 而 `host.docker.internal:5432` 是 OK。所以 `docker-compose.yml` 里给两个服务都加了
> `extra_hosts: ["host.docker.internal:host-gateway"]`，并用 `environment:` 覆盖
> `REDIS_ADDR` / `PG_HOST`。**MySQL 在 39.106.186.3，是另一台机器，公网可达，不用改。**

> **Nginx 与后端容器共用 `colorai-net` 网络，按服务名直连** —— 3001 端口不需要对外暴露，
> 也不走宿主机端口转发（容器里的 `127.0.0.1` 指的是容器自己，写它是连不上的）。

### 部署文件

| 文件 | 作用 |
|------|------|
| **`deploy/部署清单.md`** | **照着做的操作单**：10 步 + 排障速查表 + 设计决策速查 |
| **`deploy/upload_backend.py`** | **一键上传后端**：打包 → 连服务器 → 上传 → 解包 → 核对（约 647KB） |
| **`deploy/upload_dist.py`** | **一键上传前端 dist**：带路径硬校验，防 `--delete` 误删 blog 目录 |
| **`deploy/nginx_up.py`** | **colorAI 独立 nginx 容器的生命周期**：`--apply` / `--down` / `--reload` / `--verify` / `--blog-rebuild` |
| **`deploy/pack_offline.py`** | **本地打包 → 服务器离线构建**：交叉编译 Go + 预下 linux wheel → 上传（详见下） |
| **`deploy/backend_up.py`** | **在服务器上构建 + 启动后端**（走「后台执行 + 轮询」，规避 `docker build` 卡死） |
| `deploy/ssh_util.py` | 公共 SSH 基建（`run_detached` 等），给上面几个脚本共用 |
| `deploy/ssh_run.py` | **临时在服务器跑一段 shell** 的通用工具（`--file` 传脚本，避开引号地狱） |
| `docker-compose.yml` | 只编排 `go-backend` + `agent`，并创建网络 `colorai-net` |
| `docker-compose.offline.yml` | **离线构建覆盖层**，只覆盖两个服务的 `build`（必须与上面叠加使用） |
| `go-backend/Dockerfile` + `.dockerignore` | Go 多阶段构建：静态链接，运行阶段只有 alpine + 单个二进制 |
| `go-backend/Dockerfile.offline` | **无构建阶段**，直接 `COPY` 本机交叉编译好的静态二进制 |
| `go-backend/agent/Dockerfile` | 已有，本次只改了启动命令 |
| `go-backend/agent/Dockerfile.offline` | **不装 gcc、不连 PyPI**，从 `wheels/` 离线安装 |
| `deploy/nginx/colorai.conf` | **colorai-nginx 容器**的站点配置（挂到它的 `/etc/nginx/conf.d/`） |

> ⚠️ `go-backend/agent/docker-compose.yml` 是 agent **单独调试**用的，与顶层编排
> `container_name` 同名，**不要同时启动**。

### 部署步骤

**1) 上传后端**

```bash
cd /d/GoLang/colorAI
# 先 dry-run 看要传什么（不连服务器）
"C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe" deploy/upload_backend.py --dry-run
# 真上传（实测 92 个文件 / 647KB，压缩后 262KB）
"C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe" deploy/upload_backend.py
```

> 排除的重目录：`agent/.venv`(218MB)、`uploads`(7.1MB)、`tool-test-output`(1.4MB)、
> `testdata`(444KB)、`__pycache__`、`logs`、`*.exe`（本机那个 `go-backend.exe` 有 **18MB**，
> 是「上传量 19MB」这个错误印象的来源）。
> 密码从 `deploy/.sshpass` 读（已 gitignore），**推荐改用 `--key` 走密钥认证**。
> 加 `--backup` 会在远端目录非空时先整目录备份。

**2) 准备密钥文件**

```bash
cd /home/www/project/colorAI
ls -l go-backend/.env go-backend/agent/.env     # 上传时已带上，确认存在即可
# 若需重建：cp go-backend/.env.example go-backend/.env 等，再填真实值
```

**3) 起后端**

```bash
# 首次部署：目标 MySQL 若还没有业务表，先把 go-backend/.env 的
# DB_AUTO_MIGRATE 临时改成 true（建表后改回 false）
docker-compose up -d --build
docker-compose logs -f
```

这一步会创建网络 **`colorai-net`**。先起后端再配 nginx —— nginx 要接的就是这个网络。

> ### 🚀 推荐：本地打包 → 服务器离线构建
>
> 服务器内存小（1.6GB、无 swap），而**编译 Go 和 `pip install` 都完全可以在本机做掉**：
> `CGO_ENABLED=0` 的 Go 产物是**静态二进制**，与构建机无关；Python 依赖也全有
> manylinux 预编译 wheel，不需要编译。于是服务器侧只剩 `COPY`。
>
> ```bash
> cd /d/GoLang/colorAI
> PY="C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe"
> "$PY" deploy/pack_offline.py --dry-run          # 看清单（不编译、不联网）
> "$PY" deploy/pack_offline.py --download-wheels  # 下 wheel + 交叉编译 + 上传 + 远端校验
> "$PY" deploy/backend_up.py                      # 在服务器上构建 + 启动（含健康检查）
>
> # 等价于在服务器上手动执行：
> # docker-compose -f docker-compose.yml -f docker-compose.offline.yml up -d --build
> ```
>
> `backend_up.py` 支持 `--online`（改回在线构建）/ `--no-build` / `--ps` / `--logs` / `--down`。
> 它走「后台执行 + 轮询输出文件」，因为这台机器上 `docker build` **会间歇性卡死** ——
> 直接读 SSH stdout 会一直阻塞到超时。
>
> ⚠️ **必须叠加两个 `-f`** —— `offline.yml` 只覆盖 `build` 一节，
> 单独用会丢掉 `env_file` / `networks` / `healthcheck` / `extra_hosts`。
>
> 实测产物：Go 静态二进制 **12.5MB** + **69 个** wheel / **50.5MB**，上传包 **54.3MB**。
> 两个坑写在 `deploy/pack_offline.py` 文件头：**①`pip download` 在 Windows 上按 Windows
> 环境标记求值，会静默漏掉 `uvloop` 这类 Linux 专属依赖；②tar 上传把权限归一成 0644，
> 所以 `Dockerfile.offline` 里那行 `chmod +x` 删不得。**

> 🔴 **服务器内存要够（走在线构建时）。** 实测 `118.31.10.161` 只有 1.6GB 内存、**无 swap**。
> （2026-09-24 傍晚实测可用 **845MB** —— 因为 `WeKnora-neo4j` 和 `mysql8.0` 已被停掉；
> 早前只有 210MB。）agent 容器（langchain 全家桶）常驻 300~600MB、**构建期 `pip install`
> 峰值可能 0.5~1GB**，所以仍然要小心：**OOM killer 不保证只杀新容器**。
> 建议先加 2GB swap（磁盘有 8.8G 空闲），详见 `deploy/部署清单.md` 文首。
> 构建时另开一个终端 `watch -n2 free -m` 盯着。
> **上面那条离线路径基本绕开了这个问题**（峰值内存低一个数量级）。

> **首次构建会比较慢，但慢的不是 Go，是 agent。** Go 侧已配 `GOPROXY=goproxy.cn`，
> 十几秒就能编完；agent 侧要 `pip install` 装 `langchain` + `langgraph` 全家桶，
> 已配清华源（`agent/Dockerfile` 的 `PIP_INDEX`）。
>
> 如果连基础镜像都拉得慢，在服务器上配 Docker 镜像加速器（`/etc/docker/daemon.json`）：
>
> ```json
> { "registry-mirrors": ["https://<你的ID>.mirror.aliyuncs.com"] }
> ```
>
> 改完 `systemctl restart docker`。**第二次构建会复用层缓存，快很多**。

**4) 构建前端并上传**

> dist 落在 `/root/nginx/blog/colorai/`，由**独立的 `colorai-nginx` 容器**只读挂载（见第 5 步）。

```bash
cd /d/GoLang/colorAI/ColorAI && npm run build

cd /d/GoLang/colorAI
PY="C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe"
"$PY" deploy/upload_dist.py --dry-run    # 先看清单
"$PY" deploy/upload_dist.py              # 增量覆盖；--clean 等价 rsync --delete
```

> 🔴 **不要手敲 `rsync --delete`**：① 本机根本没有 `rsync`（实测缺失）；
> ② 目标写错一级就是灾难 —— `rsync -av --delete dist/ host:/root/nginx/blog/`
> （**漏了 `/colorai`**）会把 blog 自己的 `front/` 和 `admin/` **全删掉**。
> `upload_dist.py` 把「目标必须正好是 `/root/nginx/blog/<站点名>`」写成硬校验，
> 让那个错误不可能发生。
>
> ⚠️ 别手动传 `--remote-dir` —— Git Bash 会把以 `/` 开头的参数改写成
> `C:/Users/.../PortableGit/...`。默认值就是对的，**省略该参数**即可。
>
> `ColorAI/public/uploads/` 里曾放着 5 张开发期测试图 —— `vite build` 会把 `public/` 原样复制进
> `dist/`，跟着上传就变成 `https://你的域名/uploads/xxx.jpg` 公开可访问。**已清理**：
> 4 个死文件删除，`testimage.jpg`（测试脚本的默认夹具）移到 `go-backend/testdata/`。
> 现在 `public/` 只剩 favicon 与 PWA 图标，上传不需要任何排除规则。
>
> 改域名**不需要**重新构建 —— 前端浏览器侧用相对 `/api`（`src/services/api.ts`）。
> 但 `vite.config.ts` 没设 `base`，产物是 `/assets/...` 绝对路径 → **必须部署在域名根目录**。

**5) 起 colorAI 自己的 Nginx 容器**

> 为什么不是塞进 blog 那个容器、为什么换 8080：见本章开头「部署」的说明。
> 一句话 —— **blog 前端也调 `/api`**，共用 80 必然抢 `location /api/`；
> 换端口 = 换 server 块 = 天然隔离，而且 blog 零停机。
>
> blog 的 `nginx-container`（`docker run` 起的，镜像 `nginx:1.27-alpine`，
> 只接 `blog-net`，只有 80，挂载 `/root/nginx/conf.d` 与 `/root/nginx/blog`）
> **从头到尾不会被我们碰**。

```bash
# 本机执行。脚本会：建 conf 目录 → 传 conf → 校验 → 起容器 → 自动验收
cd /d/GoLang/colorAI
PY="C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe"
"$PY" deploy/nginx_up.py            # 先只读探测，看计划命令
"$PY" deploy/nginx_up.py --apply    # 真正创建
```

等价于：

```bash
docker run -d --name colorai-nginx \
  --restart unless-stopped \
  -p 8080:80 \
  -v /root/nginx/conf.d-colorai:/etc/nginx/conf.d:ro \
  -v /root/nginx/blog/colorai:/usr/share/nginx/html/colorai:ro \
  --network colorai-net \
  nginx:1.27-alpine
```

> ⚠️ 要求 `colorai-net` 已存在 → 必须先完成上面第 3 步的 `docker-compose up -d --build`。

**常用命令**：`--verify` 验收 / `--reload` 改完 conf 热加载 / `--down` 删掉（blog 不受影响）。

**6) 放行 8080 端口**

去云控制台安全组加一条入方向规则：**8080/tcp**。
服务器本机 `curl 127.0.0.1:8080` 通 **不等于**外网通 —— 不放行的话外面会超时。

然后访问 **`http://wzx.glaty.cn:8080/`**（**注意还没有 HTTPS** —— 实测 443 无监听、无 certbot，
而 **Service Worker 只在 HTTPS 下注册**，PWA 离线缓存会静默失效）。
要上 HTTPS 只需给 **`colorai-nginx`** 加 `-p 8443:443` —— 重建它**不影响 blog**，
顺手把 `colorai.conf` 的 443 server 块补上（`client_max_body_size` 等
**不会**从 80 那块继承）。见 `deploy/部署清单.md` §8。

### 几个必须知道的点

1. **`AGENT_URL` / `REDIS_ADDR` / `PG_HOST` 由编排注入，刻意不写进 `.env`。** 容器里
   `localhost` 指的是容器自己，必须用服务名 `http://agent:8000`；而 Redis / PG 跑在
   **同一台宿主机的容器里**，容器内**连公网 IP 会失败**（实测，无 hairpin NAT）→
   必须用 `host.docker.internal`。但 `go-backend/.env` 本地开发也在用，写死这些值会让
   本地连不上 —— 所以它们放在 `docker-compose.yml` 的 `environment:` 里（优先级高于 `env_file`）。
2. **Go 发布的 `127.0.0.1:3001` 只用于在服务器上排障**（`curl 127.0.0.1:3001/api/health`）。
   Nginx 容器**不走这里** —— 它通过 `colorai-net` 按服务名直连 `go-backend:3001`。
   写成 `3001:3001` 会监听 `0.0.0.0`，任何人都能绕过 Nginx 直打后端。
3. **`client_max_body_size 20m` 在 `deploy/nginx/colorai.conf` 里。** 图片走 base64 dataURL，
   `MAX_UPLOAD_BYTES=10MB` 是**解码后**的字节数，base64 膨胀 4/3 → 请求体约 13.7MB。
   Nginx 默认 1m，不放开必然 413。
   ⚠️ 用 certbot 补上 HTTPS 后，**443 那个 server 块要再写一遍这条** —— certbot 只复制
   `server_name` 和 `root`，不继承其他指令。否则会出现「http 能传图、https 传图 413」，
   而且很难查。
4. **agent 容器不对宿主机暴露端口**，只有 `go-backend` 通过 compose 内网访问它。
5. **Go 不会在容器里拉起 Agent，这是预期行为。** `manager.go` 会检查 `./agent` 目录、
   `.venv`、`.env`，容器里三者都不存在 → 只打一行「跳过启动」日志。Agent 由编排独立提供。
6. **`colorai-nginx` 必须接入 `colorai-net`**，否则解析不到 `go-backend` 这个服务名
   （日志里是 `no resolver defined` 或 `host not found in upstream`）。
   另外 `colorai.conf` 里刻意用了 `resolver 127.0.0.11` + 变量而不是直接写死服务名 ——
   **nginx 默认只在启动时解析一次上游**，`go-backend` 每次重建都会换 IP，
   不重解析就会表现为「后端明明起着，却一直 502」。
7. **OSS endpoint 按服务器地域选。** bucket 在 `cn-beijing`：服务器同地域用
   `oss-cn-beijing-internal.aliyuncs.com`（免公网流量费、延迟低），其他地域只能用公网域名。
   而 `PUBLIC_BASE_URL` **始终填 bucket 公网域名**（浏览器要能直接加载图片）。
8. **OSS 的 AK/SK 建议换成 RAM 子账号**，只授予该 bucket 的 `PutObject` / `GetObject`。
   主账号 AK 一旦泄露等于整个账号失守。
9. 🔴 **服务器内存要够。** 实测 `118.31.10.161` 只有 1.6GB 内存、**无 swap**。
   2026-09-24 傍晚实测可用 **845MB**（`WeKnora-neo4j` / `mysql8.0` 已停掉；早前只有 210MB）。
   agent 容器常驻 300~600MB、构建期 `pip install` 峰值 0.5~1GB
   → **OOM killer 不保证只杀新容器**。构建前先按 `deploy/部署清单.md` 文首处理（建议加 2GB swap）。
10. ⚠️ **别随手跑完整的 `docker-compose config` 并复制输出** —— 实测它会把 `env_file` 里的
   **所有密钥展开成明文打印**（DeepSeek / 硅基流动 / LangSmith / PG 密码全在内）。
   排语法只用 `config --services`。
11. **两套 compose 二进制都能用**：实测服务器上 `docker-compose`(1.29.2) 与
   `docker compose`(5.0.0) 都能解析本项目文件，且都保住了
   `depends_on: condition: service_healthy`。
12. ✅ **`host.docker.internal` 在用户自定义网桥上也实测可用**（2026-09-24 在 `colorai-net`
   上验证，解析成 `172.17.0.1`）—— 之前只在默认网桥测过。PG 5432 / Redis 6379
   从 `colorai-net` 容器里两个地址都通；公网 IP `118.31.10.161:5432` 仍不通（无 hairpin NAT）。

## 项目结构

```
colorAI/
├── docker-compose.yml       # 生产编排：go-backend + agent（前端不容器化）
├── docker-compose.offline.yml # 离线构建覆盖层（只覆盖 build，须与上面叠加用）
├── deploy/
│   ├── 部署清单.md           # 部署操作单（10 步 + 排障速查表）
│   ├── upload_backend.py     # 一键上传后端（paramiko，约 647KB）
│   ├── pack_offline.py       # 本地打包→服务器离线构建（交叉编译 + 预下 wheel）
│   ├── backend_up.py         # 在服务器上构建 + 启动后端（后台执行 + 轮询）
│   ├── upload_dist.py        # 一键上传前端 dist（带路径硬校验）
│   ├── nginx_up.py           # colorAI 独立 nginx 容器的生命周期
│   ├── ssh_util.py           # 公共 SSH 基建（run_detached 等）
│   ├── ssh_run.py            # 临时在服务器跑 shell 的通用工具
│   └── nginx/
│       └── colorai.conf     # colorai-nginx 的站点配置（静态产物 + /api 反代）
├── ColorAI/                 # React 前端（dist/ 由 colorai-nginx 容器只读挂载）
│   └── src/
│       ├── components/      # 共享组件
│       │   ├── SmartImage.tsx  # 图片渲染（含过期占位图）
│       │   └── workspace/      # Workspace 子组件
│       │       ├── ChatSidebar.tsx  # 会话历史侧栏
│       │       └── ToolDock.tsx     # 工具坞
│       ├── constants/       # 常量
│       │   └── workspace.ts    # FEATURES：功能可用性的唯一来源
│       ├── hooks/           # 自定义 Hooks
│       │   ├── useSession.ts  # 会话状态管理
│       │   └── useTheme.ts    # 主题切换
│       ├── lib/             # 基础工具库
│       │   ├── authFetch.ts   # 认证 fetch 封装（业务接口通道）
│       │   ├── security.ts    # PII 脱敏 / 输入净化
│       │   ├── uid.ts         # ID 生成器
│       │   └── utils.ts       # className 合并等
│       ├── pages/           # 页面组件
│       │   ├── Workspace.tsx  # AI 对话工作区
│       │   └── Login.tsx      # 登录/注册
│       ├── services/        # API 服务层
│       │   ├── api.ts             # Axios 实例（认证接口通道）
│       │   ├── chatService.ts     # AI 对话服务
│       │   └── sessionService.ts  # 会话历史 CRUD
│       ├── store/           # Zustand 状态
│       │   ├── appStore.ts    # 全局应用状态
│       │   └── authStore.ts   # 认证状态
│       ├── types/           # 全局共享类型
│       ├── utils/           # 工具函数
│       ├── API.md           # 接口契约 + 消息类型说明
│       ├── App.tsx          # 路由
│       └── main.tsx         # 应用入口
│
└── go-backend/              # Go 后端
    ├── agent/               # Python 智能体服务（含 RAG 知识库，详见 agent/README.md）
    ├── config/              # 配置结构体 + 环境变量加载
    ├── controller/          # HTTP 处理器
    │   ├── auth_controller.go      # 用户认证
    │   ├── chat_controller.go      # AI 对话代理
    │   ├── session_controller.go   # 会话管理
    │   └── user_controller.go      # 用户信息
    ├── pkg/                 # 与业务无关的公共组件（刻意不依赖本项目其他包）
    │   └── storage/                # 文件存储抽象：local / oss 双驱动
    ├── service/             # 业务逻辑层
    │   ├── auth_service.go         # 认证逻辑
    │   ├── chat_service.go         # AI 对话代理（图片经 pkg/storage 落存储）
    │   └── session_service.go      # 会话管理
    ├── repository/          # 数据访问层
    │   ├── user_repo.go            # 用户数据
    │   └── session_repo.go         # 会话数据
    ├── model/               # 数据模型
    │   ├── entity/                 # 数据库表模型
    │   ├── request/                # API 请求体
    │   └── response/               # API 响应体
    ├── database/            # 数据库连接
    ├── middleware/          # 中间件（鉴权、CORS）
    ├── doc/                 # 设计与契约文档
    ├── scripts/             # 联调脚本
    ├── testdata/            # 测试夹具（testimage.jpg —— 两个测试脚本的默认输入图）
    ├── uploads/             # 用户上传图片（仅 STORAGE_DRIVER=local 时写入）
    ├── Dockerfile           # 多阶段构建：Go 构建 → alpine + 单个静态二进制
    ├── .dockerignore        # 注意：不能整体排除 agent/（manager.go 就在里面）
    ├── app.go               # 应用初始化
    ├── router.go            # 路由注册
    └── main.go              # 服务入口
```

## API 概览

所有接口以 `/api` 为前缀，详细文档见 [API.md](ColorAI/src/API.md)。

| 接口 | 方法 | 鉴权 | 说明 |
|------|------|------|------|
| `/api/health` | GET | 公开 | 服务健康检查 |
| `/api/auth/register` | POST | 公开 | 用户注册 |
| `/api/auth/login` | POST | 公开 | 用户登录 |
| `/api/auth/logout` | POST | Token | 用户登出 |
| `/api/user/profile` | GET | Token | 获取用户信息 |
| `/api/chat` | POST | Token | AI 对话 |
| `/api/sessions` | GET | Token | 获取会话列表 |
| `/api/sessions` | POST | Token | 创建新会话 |
| `/api/sessions/:id` | GET | Token | 获取会话详情 |
| `/api/sessions/:id` | DELETE | Token | 删除会话 |

### 鉴权说明

- 需要鉴权的接口在请求头携带 `Authorization: Bearer <token>`
- Token 存储在 Redis 中，有效期 7 天
- 前端有**两条请求通道**，都会自动注入 token，但用途不同：
  - **认证接口**（`/api/auth/*`）→ Axios 实例 `services/api.ts`，请求拦截器从 `localStorage` 读取
  - **业务接口**（`/api/chat`、`/api/sessions/*`）→ `authFetch`（`lib/authFetch.ts`），直接从 Zustand store 读取
- **401 处理（两条通道行为不同，别混淆）**：
  - Axios 通道 → 清除 `localStorage` 登录态并**跳转 `/login`**
  - `authFetch` 通道 → 清除本地登录态并抛出 `AuthRequiredError`，由业务层弹出**登录引导弹窗**（不跳转）
- `/workspace` **故意不设路由守卫**：允许未登录先浏览界面，只在真的要发请求时才引导登录。
  这样比一进页面就被弹去登录页体验好。

## 数据库表结构

### users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 用户 ID |
| username | VARCHAR(64) | 用户名 |
| phone | VARCHAR(20) UNIQUE | 手机号 |
| password_hash | VARCHAR(128) | 密码 SHA-256 哈希 |
| avatar | VARCHAR(255) | 头像 URL |
| created_at | DATETIME | 创建时间 |

### chat_sessions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 会话 ID |
| user_id | VARCHAR(64) | 所属用户 |
| title | VARCHAR(255) | 会话标题 |
| message_count | INT | 消息数量 |
| created_at | BIGINT | 创建时间戳 |
| updated_at | BIGINT | 更新时间戳 |

### chat_messages

| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(64) PK | 消息 ID |
| session_id | VARCHAR(64) | 所属会话 |
| role | VARCHAR(16) | user / assistant |
| msg_type | VARCHAR(32) | text / correct |
| content | TEXT | 文本内容 |
| payload | TEXT | 扩展数据（JSON 字符串） |
| sort_order | INT | 消息排序 |
| created_at | BIGINT | 创建时间戳 |

> 知识库的三张表（`kb_chunks` / `kb_colors` / `kb_builds`）在 **PostgreSQL 的 `colorai_kb` schema** 下，
> 与上面这三张业务表不在同一个库，详见 [RAG知识库设计.md](go-backend/agent/doc/RAG知识库设计.md)。

## 认证流程

1. 用户登录 → 后端生成随机 Token → 存入 Redis
2. 前端存储 Token 至 localStorage（通过 Zustand 持久化）
3. 请求受保护接口时，前端自动注入 `Authorization: Bearer {token}`
   （认证接口走 Axios 拦截器，业务接口走 `authFetch`）
4. 后端 `RequireAuth` 中间件从 Redis 校验 Token，解析用户信息写入 Gin Context

## 相关文档

- 接口契约 + 消息类型说明：[API.md](ColorAI/src/API.md) —— 前端渲染结果卡片的依据
- 智能体服务说明：[agent/README.md](go-backend/agent/README.md) —— 接口、内置工具、RAG 知识库、如何加工具
- RAG 知识库设计：[RAG知识库设计.md](go-backend/agent/doc/RAG知识库设计.md) —— 决策依据 + 实测数据
- 智能体工具封装设计：[图片校色Tool封装设计.md](go-backend/doc/图片校色Tool封装设计.md) —— 含踩坑记录
- API 契约文档：[API 契约](go-backend/doc/API契约文档.md)
- 产品需求文档：[PRD](go-backend/doc/颜色视觉AI智能体PRD.md)
