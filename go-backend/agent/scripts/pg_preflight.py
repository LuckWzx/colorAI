"""PostgreSQL 只读预检 —— RAG 落地前的 P0 前置条件核查。

为什么手写协议而不用 psycopg：
    这个脚本要在「还没装任何依赖」的时刻就能跑，用来回答「PG 那边到底行不行」。
    所以只依赖标准库，SCRAM-SHA-256 认证在脚本内实现。

跑法（密码走环境变量，不落盘）：
    cd go-backend/agent
    PGHOST=... PGPORT=5432 PGUSER=... PGPASSWORD=... PGDATABASE=... \
        ./.venv/Scripts/python.exe scripts/pg_preflight.py

全程只发 SELECT，不做任何写操作。
"""
import base64
import hashlib
import hmac
import os
import socket
import struct
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

HOST = os.environ.get("PGHOST", "127.0.0.1")
PORT = int(os.environ.get("PGPORT", "5432"))
USER = os.environ.get("PGUSER", "postgres")
PWD = os.environ.get("PGPASSWORD", "")
TIMEOUT = float(os.environ.get("PGTIMEOUT", "10"))

# RAG 方案计划用的表名（见 doc/RAG知识库设计.md §3.2）
PLANNED_TABLES = ("kb_chunks", "kb_colors", "kb_builds")


def _recvn(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise EOFError("连接被对端关闭")
        buf += chunk
    return buf


def _recv_msg(sock):
    t = sock.recv(1)
    if not t:
        return None, None
    ln = struct.unpack("!i", _recvn(sock, 4))[0]
    body = _recvn(sock, ln - 4) if ln > 4 else b""
    return t, body


def _send_msg(sock, typ, payload=b""):
    sock.sendall(typ + struct.pack("!i", len(payload) + 4) + payload)


def _parse_error(body):
    out, i = {}, 0
    while i < len(body) and body[i:i + 1] != b"\x00":
        code = body[i:i + 1].decode("ascii", "replace")
        i += 1
        end = body.index(b"\x00", i)
        out[code] = body[i:end].decode("utf-8", "replace")
        i = end + 1
    return out


def connect(dbname):
    """建立连接并完成 SCRAM-SHA-256 认证。"""
    sock = socket.create_connection((HOST, PORT), timeout=TIMEOUT)
    sock.settimeout(TIMEOUT)
    params = f"user\x00{USER}\x00database\x00{dbname}\x00\x00".encode()
    sock.sendall(struct.pack("!ii", 8 + len(params), 196608) + params)

    server_params = {}
    while True:
        t, body = _recv_msg(sock)
        if t is None:
            raise EOFError("认证阶段连接中断")
        if t == b"E":
            raise RuntimeError(_parse_error(body))
        if t == b"S":  # ParameterStatus
            k, v = body.split(b"\x00")[:2]
            server_params[k.decode()] = v.decode()
            continue
        if t == b"Z":  # ReadyForQuery
            break
        if t in (b"K", b"N"):  # BackendKeyData / NoticeResponse
            continue
        if t != b"R":
            continue

        code = struct.unpack("!i", body[:4])[0]
        if code == 0:  # AuthenticationOk
            continue
        if code == 3:
            raise RuntimeError("服务端要求明文密码（Cleartext），脚本未实现")
        if code == 5:
            raise RuntimeError("服务端要求 MD5 认证，脚本未实现")
        if code != 10:
            raise RuntimeError(f"未预期的认证方式 code={code}")

        # --- SCRAM-SHA-256 ---
        nonce = base64.b64encode(os.urandom(18)).decode()
        cf_bare = f"n=,r={nonce}"
        cf = f"n,,{cf_bare}"
        _send_msg(sock, b"p", b"SCRAM-SHA-256\x00" + struct.pack("!i", len(cf)) + cf.encode())

        t, body = _recv_msg(sock)
        if t == b"E":
            raise RuntimeError(_parse_error(body))
        if t != b"R" or struct.unpack("!i", body[:4])[0] != 11:
            raise RuntimeError(f"未收到 SASLContinue: {t} {body[:120]}")
        sf = body[4:].decode()
        kv = dict(p.split("=", 1) for p in sf.split(",") if "=" in p)
        rnonce, salt, iters = kv["r"], base64.b64decode(kv["s"]), int(kv["i"])

        salted = hashlib.pbkdf2_hmac("sha256", PWD.encode(), salt, iters)
        client_key = hmac.new(salted, b"Client Key", hashlib.sha256).digest()
        stored_key = hashlib.sha256(client_key).digest()
        cfwp = f"c=biws,r={rnonce}"
        auth_msg = f"{cf_bare},{sf},{cfwp}".encode()
        client_sig = hmac.new(stored_key, auth_msg, hashlib.sha256).digest()
        proof = bytes(a ^ b for a, b in zip(client_key, client_sig))
        _send_msg(sock, b"p", f"{cfwp},p={base64.b64encode(proof).decode()}".encode())

        t, body = _recv_msg(sock)
        if t == b"E":
            raise RuntimeError(_parse_error(body))
        if t == b"R":
            sub = struct.unpack("!i", body[:4])[0]
            if sub == 12:  # SASLFinal，之后还有 AuthenticationOk
                t, body = _recv_msg(sock)
            if sub not in (12, 0):
                raise RuntimeError(f"认证失败 code={sub}")
        if t != b"R" or struct.unpack("!i", body[:4])[0] != 0:
            raise RuntimeError(f"认证未完成: {t} {body[:120]}")

    return sock, server_params


def query(sock, sql):
    """执行一条语句，返回 (rows, error_dict|None)。"""
    _send_msg(sock, b"Q", sql.encode() + b"\x00")
    rows, err = [], None
    while True:
        t, body = _recv_msg(sock)
        if t is None:
            raise EOFError("查询阶段连接中断")
        if t == b"D":
            n = struct.unpack("!h", body[:2])[0]
            off, row = 2, []
            for _ in range(n):
                ln = struct.unpack("!i", body[off:off + 4])[0]
                off += 4
                if ln == -1:
                    row.append(None)
                else:
                    row.append(body[off:off + ln].decode("utf-8", "replace"))
                    off += ln
            rows.append(row)
        elif t == b"E":
            err = _parse_error(body)
        elif t == b"Z":
            return rows, err


def section(title):
    print(f"\n--- {title} ---")


def main():
    print(f"目标: {USER}@{HOST}:{PORT}")
    if not PWD:
        print("⚠️  未设置 PGPASSWORD")

    sock = None
    for dbname in ([os.environ["PGDATABASE"]] if "PGDATABASE" in os.environ
                   else ["docmind", "postgres"]):
        try:
            sock, sp = connect(dbname)
            print(f"连接成功 -> 数据库 {dbname!r}")
            print(f"  服务端版本: {sp.get('server_version', '?')}")
            print(f"  server_encoding: {sp.get('server_encoding', '?')}")
            break
        except Exception as e:
            print(f"连接数据库 {dbname!r} 失败: {type(e).__name__}: {e}")
    if sock is None:
        return 1

    section("1. 版本 / 当前库")
    rows, err = query(sock, "SELECT version(), current_database(), current_user")
    if err:
        print("  错误:", err.get("M"))
    else:
        for r in rows:
            print("  ", r[0])
            print("   current_database =", r[1], "| current_user =", r[2])

    section("2. 已安装扩展")
    rows, err = query(sock, "SELECT extname, extversion FROM pg_extension ORDER BY 1")
    if err:
        print("  错误:", err.get("M"))
    else:
        for r in rows:
            print(f"   {r[0]:24s} {r[1]}")

    section("3. pgvector 是否可用（RAG 的 P0 前置条件）")
    rows, err = query(
        sock,
        "SELECT name, default_version, COALESCE(installed_version, '(未安装)') "
        "FROM pg_available_extensions WHERE name IN ('vector','pg_trgm','pgcrypto') ORDER BY 1",
    )
    if err:
        print("  错误:", err.get("M"))
    elif not rows:
        print("  ⚠️ 服务端未提供 vector / pg_trgm / pgcrypto")
    else:
        for r in rows:
            ok = r[0] == "vector" and r[2] != "(未安装)"
            print(f"   {'✅' if ok else '  '} {r[0]:10s} 可装={r[1]:8s} 已装={r[2]}")

    section("4. 已有 schema")
    rows, err = query(sock, "SELECT nspname FROM pg_namespace "
                            "WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' "
                            "ORDER BY 1")
    if err:
        print("  错误:", err.get("M"))
    else:
        print("  ", ", ".join(r[0] for r in rows))

    section("5. 是否与既有表重名")
    rows, err = query(
        sock,
        "SELECT table_schema || '.' || table_name FROM information_schema.tables "
        "WHERE table_schema NOT IN ('pg_catalog','information_schema') ORDER BY 1",
    )
    if err:
        print("  错误:", err.get("M"))
    else:
        existing = {r[0] for r in rows}
        print(f"  该库共有 {len(existing)} 张表")
        for t in PLANNED_TABLES:
            hit = "public." + t
            print(f"   {'⚠️ 已被占用' if hit in existing else '空闲 ✅'}  {hit}")

    section("6. 建表权限")
    rows, err = query(sock, "SELECT has_schema_privilege('public','CREATE'), "
                            "has_database_privilege(current_database(),'CREATE')")
    if err:
        print("  错误:", err.get("M"))
    else:
        print("  public schema CREATE =", rows[0][0], "| 本库 CREATE =", rows[0][1])

    sock.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
