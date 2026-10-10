"""酷家乐 AI 设计 Skill 探针：0 费用只读段验证（不经 LLM、不经 Agent、不经 Go）。

只调用**免费且无副作用**的三个接口（不消耗核豆、不改动账号数据）：
  1. version/check              验证 token 有效性 + 版本护栏（action 0/1/2）
  2. floorplan/standard/search  小区户型搜索（城市 areaId 从 skill 包 docs/city.json 解析）
  3. designinfo/floorplans      户型图信息（**免鉴权**；含户型评分与平面图 URL）

token 走环境变量 KJL_ACCESS_TOKEN，不落盘、不进日志（仅打印掩码）。
依赖：仅 Python 标准库（urllib），任意 Python 3.9+ 可跑。

用法（PowerShell 示例）：
    $env:KJL_ACCESS_TOKEN="xxxx"
    python scripts/test_kujiale_skill.py --city 杭州 --query 申花壹号院
    python scripts/test_kujiale_skill.py --city 杭州 --query 申花壹号院 `
        --skill-dir D:/temp/kjl-skill/ai-kujiale-design

背景：skill 包审查结论见会话记录；接口契约见 skill 包 docs/*.md。
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OAUTH_BASE = "https://oauth.kujiale.com/oauth2/openapi/ai-design-skill"
WWW_BASE = "https://www.kujiale.com"
DEFAULT_SKILL_DIR = Path("D:/temp/kjl-skill/ai-kujiale-design")
SKILL_VERSION = "0.0.6"  # 需与 review 的包版本一致（version/check 参数）

PASS = 0
FAIL = 0


def check(name: str, cond: bool, detail: str = "") -> None:
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  [OK] {name}" + (f"  — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  [!!] {name}" + (f"  — {detail}" if detail else ""))


def mask(token: str) -> str:
    return token[:4] + "****" + token[-4:] if len(token) > 8 else "****"


def http_get_json(url: str, params: dict | None = None, token: str | None = None,
                  bearer: bool = False, timeout: float = 20.0) -> dict:
    """GET 请求并解析 JSON；错误归一化为 {'__error__'|'__http_error__'|'__non_json__'}。"""
    if params:
        url = url + "?" + urllib.parse.urlencode(params)
    headers = {"accept": "application/json", "User-Agent": "colorai-kjl-probe/0.1"}
    if bearer and token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return {"__http_error__": exc.code, "body": body[:500]}
    except Exception as exc:  # noqa: BLE001 网络/TLS 等一并归口
        return {"__error__": str(exc)}
    try:
        return json.loads(body)
    except json.JSONDecodeError:
        return {"__non_json__": body[:500]}


def auth_hint(r: dict) -> str:
    code = r.get("__http_error__")
    if code in (401, 403):
        return ("token 可能无效/已轮换/未开通：请到 https://www.kujiale.com/skills "
                "重新获取密钥后重跑")
    if code == 404:
        return "路径或参数不对（404），检查接口路径与必填参数"
    return ""


def resolve_area_id(skill_dir: Path, city_name: str) -> tuple[int | None, str]:
    """从 skill 包 docs/city.json 解析城市 areaId（BFS，容忍「市」后缀差异）。"""
    city_file = skill_dir / "docs" / "city.json"
    if not city_file.exists():
        return None, f"city.json 不存在：{city_file}（用 --skill-dir 指向 skill 包目录）"
    nodes = json.loads(city_file.read_text(encoding="utf-8"))
    target = city_name.strip()
    if target.endswith("市"):
        target = target[:-1]
    queue = list(nodes)
    while queue:
        node = queue.pop(0)
        name = str(node.get("name") or "")
        if (name[:-1] if name.endswith("市") else name) == target:
            return node.get("areaId"), (
                f"{node.get('name')} (areaId={node.get('areaId')}, level={node.get('level')})")
        queue.extend(node.get("childAreas") or [])
    return None, f"city.json 中未找到「{city_name}」"


def main() -> int:
    parser = argparse.ArgumentParser(description="酷家乐 Skill 只读探针（0 费用）")
    parser.add_argument("--city", default="杭州", help="城市名（从 city.json 解析 areaId）")
    parser.add_argument("--query", default="申花壹号院", help="小区名 / 关键词")
    parser.add_argument("--area-id", type=int, default=None, help="直接指定 areaId（覆盖 --city）")
    parser.add_argument("--num", type=int, default=5, help="搜索返回条数（上限 50）")
    parser.add_argument("--is-standard", action="store_true",
                        help="只看标准户型库（is_standard=true；不传=全库）")
    parser.add_argument("--skill-dir", default=str(DEFAULT_SKILL_DIR),
                        help="skill 包目录（提供 docs/city.json）")
    args = parser.parse_args()

    token = (os.environ.get("KJL_ACCESS_TOKEN") or "").strip()
    if not token:
        print("[!!] 未设置环境变量 KJL_ACCESS_TOKEN（PowerShell: $env:KJL_ACCESS_TOKEN=\"xxx\"）")
        return 2
    print(f"token: {mask(token)}（来自环境变量，不落盘）")

    # ---------- 1) 版本校验 ----------
    print("\n=== 1) version/check 版本校验 ===")
    r = http_get_json(f"{OAUTH_BASE}/version/check",
                      {"access_token": token, "version": SKILL_VERSION})
    if "__http_error__" in r or "__error__" in r or "__non_json__" in r:
        check("接口可达且 token 有效", False, str(r)[:300])
        print(f"  [提示] {auth_hint(r) or '检查网络连通性（oauth.kujiale.com）'}")
        print(f"\n结果：通过 {PASS} / 失败 {FAIL}")
        return 2
    check("接口可达", True)
    d = r.get("d") or {}
    action = str(d.get("action", ""))
    check("c == 0", str(r.get("c")) == "0", f"c={r.get('c')!r} m={r.get('m')!r}")
    check("版本校验通过（action=0；1=过时可用，2=已禁用）", action == "0",
          f"action={action!r} isLastest={d.get('isLastest')!r} latest={d.get('latestVersion')!r}")

    # ---------- 2) 小区户型搜索 ----------
    print(f"\n=== 2) floorplan/standard/search 搜索「{args.city} / {args.query}」 ===")
    area_id = args.area_id
    if area_id is None:
        area_id, desc = resolve_area_id(Path(args.skill_dir), args.city)
        check("city.json 解析 areaId", area_id is not None, desc)
        if area_id is None:
            print(f"\n结果：通过 {PASS} / 失败 {FAIL}")
            return 2
    else:
        print(f"  [OK] 使用显式 areaId={area_id}")

    search_params = {
        "access_token": token, "start": 0, "num": max(1, min(args.num, 50)),
        "query": args.query, "area_id": area_id,
    }
    if args.is_standard:
        search_params["is_standard"] = "true"
    r = http_get_json(f"{OAUTH_BASE}/floorplan/standard/search", search_params)
    plans = ((r.get("d") or {}).get("floorPlans")) or []
    check("搜索成功（c=0）", str(r.get("c")) == "0",
          f"c={r.get('c')!r} m={r.get('m')!r} {auth_hint(r)}")
    check("返回户型非空", len(plans) > 0, f"本次返回 {len(plans)} 条，"
          f"totalCount={(r.get('d') or {}).get('totalCount')}")
    for p in plans[:5]:
        print(f"    - planId={p.get('planId')} | {p.get('commName')} | {p.get('name')} "
              f"| 建面 {p.get('srcArea')}㎡ | {str(p.get('planPic'))[:90]}")

    # ---------- 3) 户型图信息（免鉴权） ----------
    print("\n=== 3) designinfo/floorplans 户型图信息（免鉴权） ===")
    if plans:
        plan_id = plans[0].get("planId")
        r = http_get_json(f"{WWW_BASE}/api/designinfo/floorplans", {"planid": plan_id})
        infos = ((r.get("d") or {}).get("floorplanInfos")) or []
        check("接口可达且 c=0", str(r.get("c")) == "0",
              f"c={r.get('c')!r} planid={plan_id}")
        check("floorplanInfos 非空", len(infos) > 0, f"命中 {len(infos)} 个楼层")
        if infos:
            first = infos[0]
            check("planImage 存在", bool(first.get("planImage")),
                  str(first.get("planImage"))[:110])
            print(f"    - 楼层: {first.get('levelName')} | 建面 {first.get('area')}㎡ "
                  f"| 套内 {first.get('realArea')}㎡")
        score = (r.get("d") or {}).get("homeAnalysisScore") or {}
        if score:
            print(f"    - 户型评分: 总分 {(r.get('d') or {}).get('allScore')} | "
                  f"动线 {score.get('movingLineScore')} | 分区 {score.get('zoneScore')} | "
                  f"通风 {score.get('ventilationScore')}")
    else:
        print("  [--] 上一步无结果，跳过（可用 --query 换个小区名）")

    print(f"\n结果：通过 {PASS} / 失败 {FAIL}")
    return 0 if FAIL == 0 else 2


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")
    raise SystemExit(main())
