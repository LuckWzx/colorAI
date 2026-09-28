---
name: remote-deploy-ssh
description: 用 SSH/paramiko 把本地文件上传到远程服务器、以及在远程服务器上做只读环境探测与排障（尤其当目标机器内存紧张、`docker run` 会卡死时）。当用户要求「上传到服务器」「部署到服务器」「连上服务器看看环境」「服务器上跑一下这个命令」时使用。
agent_created: true
---

# 远程服务器：上传与探测

目标机器是生产服务器（本项目为 `118.31.10.161`，root）。**本机没有任何密码自动化的常规工具**，
所以路径是固定的，别去试 `sshpass` / `pscp` / `rsync`。

> 📎 **这台机器的具体事实**（内存/容器/端口/磁盘/路径/镜像缓存、`colorai-nginx` 的容器形态与
> 两个 conf 目录的区别、blog 基线、部署成功记录、待办）在
> **`references/server-profile.md`** —— 涉及「服务器上现在是什么样」时读它，
> 本文件只讲**怎么做**。数字会变，动手前先 `ssh_run.py` 复测。

## 0. 环境事实（都实测过，别再试错）

| 工具 | 本机状态 |
|---|---|
| `sshpass` / `pscp` / `plink` / `rsync` | **全部缺失** |
| `ssh` / `scp` / `tar` | 有（PortableGit 自带），但**只能交互式输密码 → 无法自动化** |
| **paramiko** | ✅ 已装在 `~/.workbuddy-ai/binaries/python/envs/default` |

```bash
PY="C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe"
```

> ⚠️ 装 paramiko 时 **`pip` 走清华源会报 `from versions: none`** —— 用默认源才成功。
> 密码里有 `?` 之类的字符，**不要走 shell**（`?` 是 glob）—— paramiko 天然绕开这个问题。

## 1. 上传：用现成脚本，别重写

```bash
cd /d/GoLang/colorAI
"$PY" deploy/upload_backend.py --dry-run    # 先看清单，不连服务器
"$PY" deploy/upload_backend.py              # 真上传
"$PY" deploy/upload_backend.py --backup     # 远端目录非空时先整目录 cp -r 备份
```

脚本已处理：打包（`tarfile`，排除重目录）→ 连服务器 → 打印远端环境 → SFTP 上传（带进度）
→ 解包（`LC_ALL=C.UTF-8`，否则中文文件名触发 PAX 扩展头告警）→ 删远端临时包 → 核对。

**改上传范围**改脚本顶部的 `MANIFEST` / `EXCLUDES`，不要在别处另写一份。
密码优先级：`--password` → `$COLORAI_SSH_PASS` → `deploy/.sshpass`（gitignore）→ 交互输入。

### `deploy/` 下的脚本分工（别重复造）

| 脚本 | 干什么 |
|---|---|
| `upload_backend.py` | 打包上传后端 |
| `pack_offline.py` | **本地打包 → 服务器离线构建**（交叉编译 Go + 预下 linux wheel）→ 见 §1.5 |
| `backend_up.py` | **在服务器上构建 + 启动后端**（`--online`/`--no-build`/`--ps`/`--logs`/`--down`）；走 `run_detached`，规避 `docker build` 卡死 |
| `upload_dist.py` | 推前端 dist（带安全硬校验） |
| `nginx_up.py` | 独立 nginx 容器生命周期（`--apply`/`--down`/`--reload`/`--verify`/`--blog-rebuild`） |
| **`ssh_util.py`** | **公共基建**：`read_remote`/`put_remote`/`run_detached`/`add_ssh_args`/`connect` |
| **`ssh_run.py`** | **临时在服务器跑一段 shell** 的通用工具 —— 排障首选，别现写脚本 |

```bash
"$PY" deploy/ssh_run.py 'free -m; swapon --show; df -h /'   # 简单命令（单引号防本地展开 $）
"$PY" deploy/ssh_run.py --file D:/tmp/probe.sh              # 复杂脚本走 --file，绕开引号地狱
```

新脚本一律 `from ssh_util import run_detached, ...`，不要各抄一份。

### 1.5 低内存服务器：把构建挪回本机（2026-09-28 跑通）

**判据**：服务器内存 < 2GB 且无 swap 时，**不要**在服务器上 `docker build`。
`golang:1.25-alpine`(329MB) 拉取 + 编译、`pip install` langchain 全家桶（峰值 0.5~1GB）
都是**完全可避免**的开销，而且 **OOM killer 不保证只杀新容器**（会波及同机的 minio / PG）。

**能挪的依据**（不是猜的）：`CGO_ENABLED=0` 的 Go 产物是**静态二进制**，与构建机无关；
Python 依赖全有 manylinux 预编译 wheel，**不需要编译**。→ 服务器侧只剩 `COPY`。

```bash
"$PY" deploy/pack_offline.py --dry-run          # 看清单，不编译不联网
"$PY" deploy/pack_offline.py --download-wheels  # 下 wheel → 交叉编译 → 上传 → 远端校验
# 服务器上：必须叠加两个 -f（offline.yml 只覆盖 build，单独用会丢 env_file/networks/healthcheck）
# docker-compose -f docker-compose.yml -f docker-compose.offline.yml up -d --build
```

#### 🔴 交叉打包最容易死的地方：**Windows 环境标记陷阱**

`pip download` 在 Windows 上**按 Windows 求值依赖的环境标记** →
`sys_platform != "win32"` 的 Linux 专属依赖被**静默跳过**，**不报任何错**。
实测漏掉 **`uvloop`**（`uvicorn[standard]` 的 extra），直到服务器上
`pip install --no-index` 才炸。

**必须做的两件事**：

1. 下载时带平台参数（`--platform` 可重复），并**用默认 PyPI 源**
   （清华源在 `pip download` 下会报 `(from versions: none)`）：
   ```
   --platform manylinux_2_28_x86_64 --platform manylinux_2_17_x86_64
   --platform manylinux2014_x86_64 --platform manylinux1_x86_64
   --python-version 3.11 --only-binary=:all: --index-url https://pypi.org/simple
   ```
2. **下载后必须按 Linux 标记重解析一遍**（读每个 wheel 内嵌 `METADATA` 的
   `Requires-Dist:` 行，用硬编码的 Linux 标记环境求值）。
   `pack_offline.py` 的 `check_wheels()` 就是干这个的 —— 它是**唯一权威**。

**两个「看起来能校验、其实同样瞎」的陷阱**（都实测过，别再踩）：

| 手段 | 为什么不算数 |
|---|---|
| `pip install --dry-run --target /tmp/x --python-version 3.11 --platform manylinux...` | `--python-version/--platform` 只筛选**候选 wheel**，环境标记仍按**宿主** `sys_platform` 求值 → 输出 `Would install ...` 里**没有 uvloop**。只能证明「名字/版本在本地目录里找得到」 |
| 自己手写解析器 | 我写过一版，`missing_linux` 收集了却忘了打印 → 输出假「✅ 完整」。**改完校验脚本，务必确认「❌ 缺哪些」那段真的能报出东西**（先故意删一个 wheel 试） |

#### 另外两个必知点

* **tar 上传会把权限统一归一成 0644** → 传上去的 Go 二进制**不可执行**，
  `CMD` 报 `permission denied`。Windows 上没有可执行位可指望 →
  只能靠离线 Dockerfile 里显式 `RUN chmod +x`，并在远端校验里 `grep` 断言它存在。
* **`COPY . .` 会把 `wheels/`（50MB）烤进镜像层** —— 后面 `RUN rm -rf /wheels` **拦不住**：
  COPY 是**新的一层**，删的是新层里的副本，旧层数据照样留在镜像里。
  → 离线 Dockerfile 只 `COPY` 明确列出的目录。
* 顺带：`go-backend/.dockerignore` 要**排除** `agent/wheels/`（否则 50MB 进 **Go** 的构建上下文）；
  但 `agent/.dockerignore` **绝不能**排除它（agent 的构建上下文是 `./go-backend/agent`）。
  一个目录名，两个 context，规则相反 —— 很容易搞错。

## 2. 远程探测：**必须用「后台执行 + 轮询文件」**

在低内存机器上，`ssh` 里直接跑 `docker run` 会让 paramiko 的 `out.read()` **一直阻塞到超时**
（连服务端的 `timeout 40` 也杀不掉 —— docker CLI 收到 SIGTERM 后会等容器停）。

**正确姿势**：命令写成脚本经 **SFTP** 落到服务器（顺带彻底绕开嵌套引号地狱），再后台跑：

```python
sftp = c.open_sftp()
with sftp.file("/tmp/probe.sh", "w") as f:
    f.write(SCRIPT)                      # SCRIPT 里可以放心用单/双引号
sftp.chmod("/tmp/probe.sh", 0o755)
sftp.remove("/tmp/probe.out")            # ⚠️ 先删旧输出，否则立刻读到上一次的哨兵
sftp.close()

c.exec_command("setsid nohup bash /tmp/probe.sh > /tmp/probe.out 2>&1 </dev/null &")
# 轮询，直到出现你自己埋的结束标记
while time.time() < deadline:
    time.sleep(2)
    out = read("/tmp/probe.out")
    if "### END" in out:
        break
```

要点：
- 脚本末尾 `echo "### END rc=$?"` 当哨兵；轮询到它就停。
- `setsid` 让进程脱离 ssh channel，CLI 被 kill 时容器不跟着挂。
- 测容器连通性用 `alpine` + `nc -z -w 4`（镜像多半已有缓存，别再拉）。
- **轮询时顺手打印输出尾部**（每增长 ~400 字节提示一次），否则看起来像卡住。

### 🔴 两个必须的细节（都踩过）

1. **脚本体要用 `( ... )` 子 shell 包住**，哨兵行才一定打得出来：

   ```bash
   #!/bin/bash
   set -uo pipefail
   (
     ...你的逻辑，里面可以放心 exit 11...
   )
   RC=$?
   echo "### END rc=$RC"
   ```

   **不包子 shell 的话，里面任何 `exit N` 都会让哨兵行不打印** →
   轮询一直等到超时 → 被误判成「卡死」。这个 bug 很难自己看出来，
   因为脚本「明明跑完了」。
2. **轮询前先删掉旧的输出文件**，否则第一次读就命中上一次的哨兵，拿到过期输出。

### 渲染 `docker run` 命令时

要打印/执行「从 `docker inspect` 推导出的重建命令」时：

- **每个 token 单独加引号**，按「参数单元」分组换行。
  ❌ `shlex.quote("-v /root/x:/etc/y")` → `'-v /root/x:/etc/y'` 会被 docker 当成
  **一个未知 flag**，直接报错。✅ 分开：`-v` 和 `/root/x:/etc/y` 各自 quote。
- 重建命令**一定从 `docker inspect` 现场推导**，不要手抄 —— 漏一个挂载就把线上站点弄挂。
- `docker inspect` 的 `PortBindings` 键是 `80/tcp`；tcp 是默认协议，**归一化掉**再渲染，
  否则会写出 `-p 80:80/tcp`（合法但难看）。
- 镜像自带的 `ENV`（`DYNPKG_RELEASE` / `NJS_RELEASE` / `NGINX_VERSION` …）和 `LABEL`
  （`maintainer`）会出现在 inspect 里 → 要**跟镜像的 env/label 比对后过滤**，
  否则看起来像「我们设过这些」。

## 3. 探测时先问这几个问题

只读、先摸清再动手：

```bash
uname -sr; cat /etc/os-release | grep PRETTY_NAME
free -m; swapon --show                  # ← 内存 + swap，最容易被忽略的阻断项
df -h /
docker --version; docker-compose --version; docker compose version   # 两套可能并存
docker ps --format '{{.Names}}\t{{.Ports}}'
docker network ls
ss -lntp | grep -E ':(80|443|3306|5432|6379)\s'
```

## 4. 三个踩过的坑

1. 🔴 **`docker-compose config`（完整版）会把 `env_file` 里的密钥全部展开成明文打印**
   （API key、DB 密码全在内）。排语法只用 `config --services`，或 `config > /dev/null`。
   **别把输出贴到任何地方。**
2. 🔴 **容器里连宿主机的公网 IP 会失败。** 目标机器的 Redis/PG 是**本机容器**，只发布端口，
   从容器内连 `118.31.10.161:5432` → FAIL（宿主机不给自己做 hairpin NAT）。
   可用：`host.docker.internal`（配 `extra_hosts: ["host.docker.internal:host-gateway"]`）
   或 `172.17.0.1`。**别把这个判断留在"应该是通的"上，实测一条 `nc` 只要几秒。**
   ✅ 2026-09-24 补测：**`host.docker.internal` 在用户自定义网桥上同样可用**
   （在 `colorai-net` 上实测解析成 `172.17.0.1`）—— 之前只在默认网桥验证过，现在这个缺口补上了。
3. ⚠️ **低内存机器上 `docker run` 会间歇卡死**（本次探测复现 3 次）。看到超时先怀疑内存，
   别急着怀疑命令写错了。顺带：这类机器上 `docker build` 的 `pip install` 阶段也可能被 OOM 杀，
   而且 **OOM killer 不保证只杀新容器** —— 可能波及机器上原有的服务。
4. ⚠️ **`docker stop` 之后重启策略会被忽略。** 精确规则：
   **「手动 `docker stop` 后，该容器的重启策略被忽略 —— 直到 daemon 重启或容器被手动 start」**。
   → 看到「内存突然变宽裕」，先 `docker ps -a` 确认是不是有人停了什么，
   **别默认它一直会保持停止**（daemon 重启后它会自己回来）。
5. ⚠️ **判 OOM 看 `.State.OOMKilled`，别只看退出码。**
   `ExitCode=137` **同时** `OOMKilled=false` 是 `docker stop` 的 SIGTERM→SIGKILL 签名，**不是 OOM**。
   想坐实 OOM 还要看 `journalctl -k | grep -i oom-kill`。
   → 我一度把 `Exited (137)` 直接说成「被 OOM 杀了」，证据立刻打脸，**别再犯**。
6. ⚠️ **端口映射不能热加，但网络可以。** `docker network connect` 能给运行中的容器加网络；
   加 `-p` 只能重建容器。所以「要不要重建」先看你要加的是哪一样。
   **优先考虑「另起一个独立容器」而不是重建线上那个** —— 独立容器零停机、隔离更好、
   回滚一行；重建线上容器会中断它，且必须把原有参数一条不漏复现。

## 5. 改完远端配置要复核

改了 compose / `.env` 后，**重新上传再在服务器上复核一遍**，不要假设传上去了就对：

```bash
cd <项目目录> && docker-compose config 2>/dev/null | grep -E '<你要确认的键>'
```

用 grep 白名单，**不要 dump 整个 config**（见坑 1）。
