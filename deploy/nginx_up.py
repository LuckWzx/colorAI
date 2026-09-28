#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""曲泉AI —— colorAI 独立 nginx 容器的生命周期（up / down / reload / verify）。

════════════════════════════ 为什么是独立容器 ════════════════════════════════
用户只有一个域名 wzx.glaty.cn，已被 blog 占用（80）。blog 前端**也**调 `/api`，
共用 80 必然抢 `location /api/`。→ 给 colorAI 单开 **8080**（换 listen 端口 = 换
server 块 = `/api` 天然隔离，前端代码零改动）。

加端口映射必须重建容器（端口不能热加）。两条路：

  ❌ 重建 blog 的 nginx-container
     代价：wzx.glaty.cn 断 2~3 秒；以后每次改 colorAI 的 nginx 都要再冒一次 blog 的
          风险；重建命令还得把 blog 的挂载/网络**一条不漏**地复现。

  ✅ 新建独立 colorai-nginx（本脚本）
     代价：多一个 nginx 进程（实测 ~6MB）。
     好处：**blog 零停机**；conf 目录与内容目录全独立、且内容**只读**挂载；
           以后改 colorAI 的 nginx（换端口 / 上 HTTPS / 改配置）**完全不影响 blog**；
           回滚一行 `docker rm -f colorai-nginx`。

════════════════════════════════ 容器形态 ═══════════════════════════════════
    docker run -d --name colorai-nginx \\
      --restart unless-stopped \\
      -p 8080:80 \\
      -v /root/nginx/conf.d-colorai:/etc/nginx/conf.d:ro \\
      -v /root/nginx/blog/colorai:/usr/share/nginx/html/colorai:ro \\
      --network colorai-net \\
      nginx:1.27-alpine

  容器内 listen 80，宿主暴露成 8080。conf 目录里**只有 colorai.conf**，
  所以不存在「和 blog-nginx.conf 争 default_server」的排序问题。

════════════════════════════════ 用法 ══════════════════════════════════════
    python deploy/nginx_up.py                 # ① 只读：看现状 + 计划命令（默认）
    python deploy/nginx_up.py --apply         # ② 建/更新容器（先传 conf，再校验再起）
    python deploy/nginx_up.py --reload        # ③ 只重载配置（改了 conf 之后）
    python deploy/nginx_up.py --verify        # ④ 只跑验收
    python deploy/nginx_up.py --down          # ⑤ 删掉 colorai-nginx（blog 不受影响）
    python deploy/nginx_up.py --blog-rebuild  # ⑥ 导出 blog 容器的等价重建命令（安全网）

依赖 paramiko，用本机隔离 venv 跑：
    C:/Users/魏正想/.workbuddy-ai/binaries/python/envs/default/Scripts/python.exe \\
        deploy/nginx_up.py
"""

from __future__ import annotations

import argparse
import json
import shlex
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from ssh_util import (  # noqa: E402
    add_ssh_args,
    connect,
    log,
    put_remote,
    read_remote,
    run,
    run_detached,
)

# ---------------------------------------------------------------- 常量

BLOG_CONTAINER = "nginx-container"
CONTAINER = "colorai-nginx"

IMAGE = "nginx:1.27-alpine"
HOST_PORT = 8080
CONTAINER_PORT = 80

CONF_DIR_HOST = "/root/nginx/conf.d-colorai"
CONF_HOST = f"{CONF_DIR_HOST}/colorai.conf"
CONTENT_HOST = "/root/nginx/blog/colorai"
CONTENT_IN_CONTAINER = "/usr/share/nginx/html/colorai"

NETWORK = "colorai-net"

CONF_LOCAL = Path(__file__).resolve().parent / "nginx" / "colorai.conf"

HOST_HEADER = "wzx.glaty.cn"

# 镜像自带的 ENV/LABEL —— 导出 blog 重建命令时要把它们过滤掉，
# 免得看起来像是「我们设过这些」。
IMAGE_BAKED_ENV = {
    "PATH",
    "HOME",
    "NGINX_VERSION",
    "NJS_VERSION",
    "PKG_RELEASE",
    "DYNPKG_RELEASE",
    "NJS_RELEASE",
}


def container_cmd() -> list[list[str]]:
    """colorai-nginx 的 docker run 命令，按「参数单元」分组（每单元渲染成一行）。"""
    return [
        ["docker", "run", "-d", "--name", CONTAINER],
        ["--restart", "unless-stopped"],
        ["-p", f"{HOST_PORT}:{CONTAINER_PORT}"],
        ["-v", f"{CONF_DIR_HOST}:/etc/nginx/conf.d:ro"],
        ["-v", f"{CONTENT_HOST}:{CONTENT_IN_CONTAINER}:ro"],
        ["--network", NETWORK],
        [IMAGE],
    ]


def render(units: list[list[str]], indent: str = "  ") -> str:
    """每行一个参数单元；单个 token 内部含空格才加引号（`-v` 这种绝不能整体加引号）。"""
    return (" \\\n" + indent).join(
        " ".join(shlex.quote(t) for t in unit) for unit in units
    )


# ---------------------------------------------------------------- blog 容器探测


def fetch_spec(client, name: str) -> dict | None:
    rc, out, _ = run(client, f"docker inspect {shlex.quote(name)}", timeout=60, check=False)
    if rc != 0:
        return None
    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        return None
    return data[0] if data else None


def summarize(spec: dict, image_labels: dict) -> dict:
    hc = spec.get("HostConfig") or {}
    cfg = spec.get("Config") or {}
    ns = spec.get("NetworkSettings") or {}

    ports: dict[str, str] = {}
    for cport, binds in (hc.get("PortBindings") or {}).items():
        cport_num, _, proto = cport.partition("/")
        cport_clean = cport_num if proto in ("", "tcp") else f"{cport_num}/{proto}"
        for b in binds or []:
            hp = (b.get("HostPort") or "").strip()
            hi = (b.get("HostIp") or "").strip()
            ports[f"{hi}:{hp}" if hi else hp] = cport_clean

    mounts = [
        {"src": m.get("Source"), "dst": m.get("Destination"), "rw": bool(m.get("RW"))}
        for m in spec.get("Mounts") or []
    ]
    nets = {n: (i.get("IPAddress") or "") for n, i in (ns.get("Networks") or {}).items()}
    env = [e for e in (cfg.get("Env") or []) if e.split("=", 1)[0] not in IMAGE_BAKED_ENV]
    labels = {k: v for k, v in (cfg.get("Labels") or {}).items() if image_labels.get(k) != v}

    return {
        "name": (spec.get("Name") or "").lstrip("/"),
        "image": cfg.get("Image"),
        "restart": (hc.get("RestartPolicy") or {}).get("Name") or "",
        "network_mode": hc.get("NetworkMode") or "",
        "ports": ports,
        "mounts": mounts,
        "nets": nets,
        "env": env,
        "labels": labels,
        "running": bool((spec.get("State") or {}).get("Running")),
        "status": (spec.get("State") or {}).get("Status") or "",
    }


def blog_rebuild_cmd(client, extra_ports: list[str] | None = None) -> str:
    """从现场 inspect 数据推导 blog 容器的等价重建命令。

    ⚠️ 只在**真的需要动 blog 容器**时用（例如给 blog 上 HTTPS）。
    正常部署 colorAI **不需要**碰它 —— 我们有独立的 colorai-nginx。
    """
    spec = fetch_spec(client, BLOG_CONTAINER)
    if spec is None:
        return f"（找不到容器 {BLOG_CONTAINER}）"

    img_ref = (spec.get("Config") or {}).get("Image") or ""
    image_labels = {}
    if img_ref:
        rc, out, _ = run(
            client,
            f"docker inspect {shlex.quote(img_ref)} --format '{{{{json .Config.Labels}}}}'",
            timeout=30,
            check=False,
        )
        if rc == 0:
            try:
                image_labels = json.loads(out.strip() or "{}") or {}
            except json.JSONDecodeError:
                image_labels = {}

    s = summarize(spec, image_labels)

    units: list[list[str]] = [["docker", "run", "-d", "--name", BLOG_CONTAINER]]
    if s["restart"]:
        units.append(["--restart", s["restart"]])
    ports = [f"{hp}:{cp}" for hp, cp in sorted(s["ports"].items(), key=lambda kv: str(kv[1]))]
    for p in extra_ports or []:
        if p not in ports:
            ports.append(p)
    for p in ports:
        units.append(["-p", p])
    for m in s["mounts"]:
        units.append(["-v", f"{m['src']}:{m['dst']}" + ("" if m["rw"] else ":ro")])
    if s["network_mode"] and s["network_mode"] not in ("default", "bridge", "none"):
        units.append(["--network", s["network_mode"]])
    for e in s["env"]:
        units.append(["-e", e])
    for k, v in s["labels"].items():
        units.append(["-l", f"{k}={v}"])
    units.append([s["image"]])

    lines = [" ".join(shlex.quote(t) for t in u) for u in units]
    return (" \\\n  ").join(lines)


# ---------------------------------------------------------------- 动作


def show_paths() -> None:
    """把「哪个文件在哪」直接摆出来 —— 这两个 conf 目录很容易搞混。"""
    log("\n── 路径对照（两个容器各看各的 conf 目录）────────")
    log(f"  本站点配置（仓库里）   deploy/nginx/colorai.conf")
    log(f"  本站点配置（服务器）   {CONF_HOST}")
    log(f"  本站点内容（服务器）   {CONTENT_HOST}   → 容器内 {CONTENT_IN_CONTAINER}（只读）")
    log("")
    log(f"  colorai-nginx  挂的是 {CONF_DIR_HOST}/          ← 只有 colorai.conf")
    log("  nginx-container 挂的是 /root/nginx/conf.d/    ← 只有 blog-nginx.conf，我们不碰")
    log("")
    log("  ⚠️ 不要把 colorai.conf 放进 /root/nginx/conf.d —— 那个目录也挂进了 blog 容器，")
    log("     两边都是 listen 80 + server_name wzx.glaty.cn，会撞同名 server_name。")


def show_state(client) -> None:
    log("\n── 现状 ─────────────────────────────────────")

    for name in (BLOG_CONTAINER, CONTAINER):
        spec = fetch_spec(client, name)
        if spec is None:
            log(f"\n  {name:<16} 不存在")
            continue
        st = (spec.get("State") or {})
        hc = spec.get("HostConfig") or {}
        log(f"\n  {name:<16} {st.get('Status')}   image={(spec.get('Config') or {}).get('Image')}")
        log(f"  {'':<16} restart={(hc.get('RestartPolicy') or {}).get('Name')}")
        ports = []
        for cport, binds in (hc.get("PortBindings") or {}).items():
            for b in binds or []:
                ports.append(f"{b.get('HostPort')}→{cport}")
        log(f"  {'':<16} ports={ports or '(无)'}")
        nets = list(((spec.get("NetworkSettings") or {}).get("Networks") or {}).keys())
        log(f"  {'':<16} networks={nets or '(无)'}")
        for m in spec.get("Mounts") or []:
            mode = "rw" if m.get("RW") else "ro"
            log(f"  {'':<16} mount [{mode}] {m.get('Source')} → {m.get('Destination')}")


def do_verify(client) -> int:
    log("\n── 验收 ─────────────────────────────────────")
    script = f"""
echo "--- colorai-nginx 容器 ---"
docker ps -a --filter "name=^{CONTAINER}$" --format '{{{{.Names}}}}  {{{{.Status}}}}  {{{{.Ports}}}}'
echo "--- 端口映射 ---"
docker inspect {CONTAINER} --format '{{{{range $p, $c := .HostConfig.PortBindings}}}}{{{{$p}}}} -> {{{{ (index $c 0).HostPort }}}}{{{{println}}}}{{{{end}}}}' 2>&1
echo "--- 网络 ---"
docker inspect {CONTAINER} --format '{{{{range $k,$v := .NetworkSettings.Networks}}}}{{{{$k}}}} {{{{end}}}}' 2>&1
echo "--- 配置自检 ---"
docker exec {CONTAINER} nginx -t 2>&1
echo "--- colorAI（8080）---"
curl -s -o /dev/null -w 'colorai首页   %{{http_code}}\\n' -H 'Host: {HOST_HEADER}' http://127.0.0.1:{HOST_PORT}/
curl -s -o /dev/null -w 'colorai清单   %{{http_code}}\\n' -H 'Host: {HOST_HEADER}' http://127.0.0.1:{HOST_PORT}/manifest.webmanifest
echo "--- 静态资源 ---"
ASSET=$(docker exec {CONTAINER} sh -c 'ls /usr/share/nginx/html/colorai/assets/*.js 2>/dev/null | head -1')
if [ -n "$ASSET" ]; then
  REL=$(echo "$ASSET" | sed 's#/usr/share/nginx/html/colorai##')
  curl -s -o /dev/null -w "colorai资源 $REL  %{{http_code}}\\n" -H "Host: {HOST_HEADER}" "http://127.0.0.1:{HOST_PORT}$REL"
else
  echo "  (没找到 assets/*.js)"
fi
echo "--- 后端 API（后端还没起时 502 是预期的）---"
curl -s -o /dev/null -w 'api/health    %{{http_code}}\\n' -H 'Host: {HOST_HEADER}' http://127.0.0.1:{HOST_PORT}/api/health
echo "--- blog 是否受影响（必须还是 200 / 301）---"
curl -s -o /dev/null -w 'blog首页      %{{http_code}}\\n' -H 'Host: {HOST_HEADER}' http://127.0.0.1/
curl -s -o /dev/null -w 'blog后台      %{{http_code}}\\n' -H 'Host: {HOST_HEADER}' http://127.0.0.1/admin
echo "--- 配置目录（两个容器各看各的，别搞混）---"
echo "[colorai] 宿主 {CONF_DIR_HOST}/"
ls -l {CONF_DIR_HOST}/ 2>&1
echo "[colorai] 容器内 /etc/nginx/conf.d/"
docker exec {CONTAINER} ls -l /etc/nginx/conf.d/ 2>&1
echo "[blog   ] 宿主 /root/nginx/conf.d/   ← 这是 blog 的，我们不碰"
ls -l /root/nginx/conf.d/ 2>&1
echo "--- 内容目录（只读挂载是否看得见）---"
docker exec {CONTAINER} ls /usr/share/nginx/html/colorai 2>&1 | head -10
"""
    rc, out = run_detached(client, script, timeout=180)
    log(out.rstrip())
    return rc


def do_apply(client, conf: Path) -> int:
    log("\n" + "=" * 64)
    log("创建 / 更新 colorai-nginx")
    log("=" * 64)

    if not conf.exists():
        raise SystemExit(f"✗ 本地配置不存在：{conf}")
    if b"\r\n" in conf.read_bytes():
        raise SystemExit("✗ 配置里有 CRLF —— nginx 会报 unknown directive，先转成 LF 再传")

    cmd = render(container_cmd())
    log("\n→ 计划执行的命令：\n")
    for line in cmd.splitlines():
        log(f"    {line}")
    log("")

    # 1) 建目录 + 传配置
    log(f"→ 准备配置目录 {CONF_DIR_HOST}")
    run(client, f"mkdir -p {shlex.quote(CONF_DIR_HOST)}")
    log(f"→ 上传 {conf.name} → {CONF_HOST}")
    put_remote(client, conf, CONF_HOST)
    _, out, _ = run(client, f"ls -l {shlex.quote(CONF_HOST)} && grep -nE 'listen|server_name|root' {shlex.quote(CONF_HOST)} | head -6", check=False)
    log(out.rstrip())

    # 2) 容器已在 → 先校验配置再重载；不在 → 创建
    exists = fetch_spec(client, CONTAINER) is not None
    if exists:
        log("\n→ 容器已存在，先校验配置再重载")
        rc, out, err = run(client, f"docker exec {CONTAINER} nginx -t 2>&1", timeout=60, check=False)
        log(out.rstrip() or err.rstrip())
        if rc != 0:
            raise SystemExit("✗ nginx -t 失败 —— 已保留旧容器，未做任何变更")
        rc, out, err = run(client, f"docker exec {CONTAINER} nginx -s reload 2>&1", timeout=60, check=False)
        log(out.rstrip() or err.rstrip() or "(reload 完成)")
        return do_verify(client)

    # 3) 创建容器
    body = f"""
echo "=== 检查前置条件 ==="
if ! docker image inspect {shlex.quote(IMAGE)} >/dev/null 2>&1; then
  echo "!! 本机没有镜像 {IMAGE}，需要先 docker pull"
  exit 31
fi
echo "镜像 {IMAGE} 在"
if ! docker network inspect {shlex.quote(NETWORK)} >/dev/null 2>&1; then
  echo "!! 网络 {NETWORK} 不存在（后端还没起过 compose）"
  exit 32
fi
echo "网络 {NETWORK} 在"
if [ ! -f {shlex.quote(CONTENT_HOST + '/index.html')} ]; then
  echo "!! 内容目录没有 index.html：{CONTENT_HOST}"
  exit 33
fi
echo "内容目录 OK"

echo "=== 清理同名旧容器（如果存在）==="
docker rm -f {shlex.quote(CONTAINER)} >/dev/null 2>&1 || true

echo "=== 创建容器 ==="
{cmd}
RC=$?
echo "docker run 退出码：$RC"
if [ $RC -ne 0 ]; then
  echo "!! docker run 失败"
  exit 34
fi

sleep 3
echo "=== 状态 ==="
docker ps -a --filter "name=^{CONTAINER}$" --format '{{{{.Names}}}}  {{{{.Status}}}}  {{{{.Ports}}}}'
echo "=== 容器内配置自检 ==="
docker exec {CONTAINER} nginx -t 2>&1 || {{ echo "!! 容器内 nginx -t 失败"; docker logs --tail 30 {CONTAINER} 2>&1; exit 35; }}
"""
    rc, out = run_detached(client, body, timeout=240)
    log(out.rstrip())
    if rc != 0:
        log(f"\n❌ 创建失败（退出码 {rc}）")
        return rc

    return do_verify(client)


def do_reload(client) -> int:
    log("\n→ 校验并重载 colorai-nginx")
    rc, out, err = run(client, f"docker exec {CONTAINER} nginx -t 2>&1", timeout=60, check=False)
    log(out.rstrip() or err.rstrip())
    if rc != 0:
        log("✗ nginx -t 失败，未重载")
        return rc
    rc, out, err = run(client, f"docker exec {CONTAINER} nginx -s reload 2>&1", timeout=60, check=False)
    log(out.rstrip() or err.rstrip() or "(reload 完成)")
    return do_verify(client)


def do_down(client) -> int:
    log("\n→ 删除 colorai-nginx（blog 不受影响）")
    body = f"""
if docker inspect {shlex.quote(CONTAINER)} >/dev/null 2>&1; then
  docker rm -f {shlex.quote(CONTAINER)}
  echo "已删除 {CONTAINER}"
else
  echo "{CONTAINER} 本来就不存在"
fi
echo "--- blog 复查（必须还是 200）---"
curl -s -o /dev/null -w 'blog首页 %{{http_code}}\\n' -H 'Host: {HOST_HEADER}' http://127.0.0.1/
"""
    rc, out = run_detached(client, body, timeout=120)
    log(out.rstrip())
    return rc


# ---------------------------------------------------------------- main


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

    ap = argparse.ArgumentParser(
        description="colorAI 独立 nginx 容器的生命周期",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--apply", action="store_true", help="创建/更新容器（会传 conf）")
    ap.add_argument("--reload", action="store_true", help="只重载配置")
    ap.add_argument("--verify", action="store_true", help="只跑验收")
    ap.add_argument("--down", action="store_true", help="删除 colorai-nginx")
    ap.add_argument("--blog-rebuild", action="store_true", help="导出 blog 容器的等价重建命令")
    ap.add_argument("--conf", default=str(CONF_LOCAL), help="本地站点配置路径")
    add_ssh_args(ap)
    args = ap.parse_args()

    client = None
    try:
        client = connect(args)

        if args.down:
            return do_down(client)
        if args.verify:
            return do_verify(client)
        if args.reload:
            return do_reload(client)
        if args.blog_rebuild:
            log("\n── blog 容器（nginx-container）的等价重建命令 ──")
            log("  ⚠️ 正常部署 colorAI **不需要**动它。只在真要改 blog 时（如上 HTTPS）用。\n")
            log("    " + blog_rebuild_cmd(client).replace("\n", "\n"))
            return 0

        log("=" * 64)
        log("曲泉AI —— colorAI 独立 nginx 容器")
        log("=" * 64)
        log(f"服务器   {args.user}@{args.host}:{args.port}")
        log(f"模式     {'APPLY（会建容器）' if args.apply else 'INSPECT（只读）'}")

        show_state(client)
        show_paths()

        log("\n── 计划创建的容器命令 ───────────────────────\n")
        for line in render(container_cmd()).splitlines():
            log(f"    {line}")
        log("")

        if not args.apply:
            log("── 只读探测结束，未改动任何东西 ───────────────")
            log("  确认无误后：python deploy/nginx_up.py --apply")
            log(f"  ⚠️ 别忘了去云控制台安全组放行 {HOST_PORT}/tcp，否则外面访问不到。")
            return 0

        return do_apply(client, Path(args.conf))

    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001
        log(f"\n✗ 失败：{type(exc).__name__}: {exc}")
        return 1
    finally:
        if client is not None:
            client.close()


if __name__ == "__main__":
    sys.exit(main())
