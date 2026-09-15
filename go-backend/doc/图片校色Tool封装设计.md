# 图片校色 Tool 封装设计

> 目标：把搭档提供的校色接口（见 `Color_Correction.md`）封装为 LangGraph Tool，供 Agent 调用。
> 范围：V1.0 只做「图片一键校色」这一个工具。其余四个工具**已从工具列表中移除**
> （不是"保持现状"）—— 它们原本是返回假数据的 stub，留在列表里会让 LLM 把编造的
> 色值/相似度包装成专业结论返回给用户。详见 §8.2。

---

## 一、接口回顾

| 项目 | 值 |
|------|-----|
| 路径 | `POST https://api3.ququan.net/quality/api/quality_check` |
| Content-Type | `multipart/form-data` |
| 请求参数 | `image`：file（待校正图片） |

**成功响应（`passed=true`）**

```json
{
  "brand": "Unknown",
  "device_info": "未知设备",
  "distance": 0.2927,
  "elapsed_time": 9.859187602996826,
  "original": "https://f3.ququan.net/temp/check/xxx_orig.jpg",
  "passed": true,
  "results": [
    { "corrected": "https://f3.ququan.net/temp/check/xxx_corr_0_...jpg", "distance": 0.0928, "model_name": "Apple iPhone17e/IMG_9921_1.jpg" },
    { "corrected": "https://f3.ququan.net/temp/check/xxx_corr_1_...jpg", "distance": 0.0942, "model_name": "Huawei Hera-BD00/120_1" }
  ],
  "threshold": 0.6
}
```

**失败响应（`passed=false`）—— 注意仍是 HTTP 200**

```json
{
  "brand": "Unknown",
  "distance": 0.7052,
  "error": "当前拍摄环境与标准环境不匹配（距离 0.7052 ≥ 阈值 0.600），请重新拍摄",
  "passed": false,
  "threshold": 0.6
}
```

**五个必须注意的点：**

1. 接口吃的是**文件字节**（multipart 上传），不是 URL、不是 base64。
2. 返回的 `original` / `results[].corrected` 都是 `f3.ququan.net` 上的**外部 URL**，不归我们管。
3. `passed=false` 是**业务失败但 HTTP 200**，不是异常 —— 不能用 `raise_for_status()` 兜住。
4. 示例 `elapsed_time ≈ 9.86s`，**这是个慢接口**，直接影响超时设计（见决策 5）。
5. URL 路径含 `/temp/check/`，**疑似临时链接**，需与搭档确认有效期（见第九节）。

---

## 二、动手前必须先对齐的四处

### 2.1 工具命名四处不一致

| 出处 | 名称 |
|------|------|
| `agent/app/tools/color_tools.py`（现有代码） | `image_correction` |
| `ColorAI/src/API.md` | `image_correction` |
| `colorAgent4.md` §15.1 | `color_calibration` |
| `python工具方协议.md` | `color_correction` |

**建议统一为 `image_correction`。** 理由：代码里的 `get_all_tools()`、`TOOL_TYPE_MAPPING`、以及系统提示词（`agent.py` 第 32-36 行）都已在用这个名字，选它等于零代码改动；另外两份文档订正一下即可。

### 2.2 返回结构对不上（最关键）

前端 `CorrectionResult`（`ColorAI/src/types/index.ts`）目前长这样：

```ts
export interface CorrectionResult {
  originalImage: string;
  correctedImage: string;
  metadata: {
    brightness: number;
    contrast: number;
    saturation: number;
    whiteBalance: 'warm' | 'cool' | 'neutral';
  };
}
```

真实接口返回的是 `brand / device_info / distance / elapsed_time / original / passed / results[] / threshold`。三个硬冲突：

1. **`metadata.brightness / contrast / saturation / whiteBalance` 真实接口完全不返回** —— 这四个字段是当初写 stub 时编出来的，属于虚构契约。
2. **真实接口返回多个候选校正图**（示例 3 张），前端只支持 1 张。
3. 真实接口没有 `correctedImage` 字段，只有 `results[].corrected`。

影响是实打实的：`Workspace.tsx` 的 correct 卡片直接读 `res.metadata.brightness`（第 937 行）和 `res.metadata.whiteBalance`（第 944-948 行）。**不改前端，卡片会渲染出空白和 NaN。**

### 2.3 图片怎么进到 tool

接口要文件字节，所以必须有人把图片"实体"送到 tool 手上。三种来源：

| 方案 | 链路 | 评价 |
|------|------|------|
| base64 一路透传 | 前端 → Go → Agent → tool | ❌ 与 `python工具方协议.md` 的结论相悖，链路臃肿 |
| **完整 URL（已定）** | Go 落盘得 URL，tool 直接 HTTP GET | ✅ 已确认采用，见 2.4 |
| 存储 key | Go 落盘得 key，tool 解析成本地路径 | 备选；历史回放不会失效，但多一层解析 |

### 2.4 URL 过期与前端兜底（已确认的处理方式）

**已确认：存完整 URL，不存 key；过期时由前端展示"已过期"占位样式。**

这是可接受的取舍。实施时注意三点：

**(1) 必须区分「真过期」和「暂时加载失败」**

`<img onError>` 会对**任何**失败触发 —— 包括网络抖动、用户断网、CDN 临时 5xx。一失败就判定"已过期"会误导用户。建议**失败后重试一次**（间隔 1-2s）仍失败，才切到过期态。

**(2) 预留布局空间**

图片挂掉后容器塌陷会让消息列表跳动。用固定宽高比容器（CSS `aspect-ratio`）把位置占住。

**(3) 给一个"重新生成"出口**

如果原图还在我们的存储里，过期只是展示问题 —— 用户可以重新触发一次校色。比单纯显示"已过期"有用得多。

**顺带解决的好事：** `chat_service.go` 目前把整段 base64 写进 `chat_messages.payload`（几 MB 一行 TEXT）。改成存 URL 后 payload 只有几十字节，**DB 膨胀问题自然消失**。

**切 OSS 时的注意点：** 如果 OSS 用**短时效签名 URL**，历史回放会**全部**显示"已过期"（签名早失效了）。若希望历史图仍可看，建议桶用**公共读**或给较长 TTL —— 否则这个兜底样式会变成常态而非异常。

---

## 三、关键决策

### 决策 1：Tool 入参用 `image_url`（完整 URL），不用 base64

```python
def image_correction(image_url: str) -> dict
```

tool 内部直接 `httpx.get(image_url)` 拿到字节，再 multipart 转发给校色接口。

**为什么不用 base64：** tool 的参数是 LLM 生成的。一张手机照片的 base64 是几 MB，让 LLM 把它作为 tool 参数"复述"出来物理上不可能。URL 只有几十字符，LLM 可以原样搬运。

**选 URL 带来的简化：** Python 侧**完全不需要存储相关代码** —— 不用知道 `UPLOADS_DIR`、不用处理本地/OSS 分支，就是一个 HTTP GET。这是这个方案最大的好处。

**代价（已接受）：** URL 会过期，历史回放靠前端兜底（见 2.4）。

### 决策 2：Go 侧统一「收图落盘 → 只把 URL 传给 Agent」

前端目前把图片以 dataURL 放在 `/api/chat` 的 `images` 字段里。**Go 在转发给 Agent 之前，把 base64 解码落盘，替换成可访问的完整 URL。**

- Agent 与 tool 永远看不到 base64
- 落盘位置用现有的 `go-backend/uploads/`（`router.go` 第 20 行已挂静态路由）
- **URL 前缀走配置**（如 `PUBLIC_BASE_URL=http://localhost:3001`），不要硬编码 —— 以后切 OSS 只改这一个值
- 图片 URL 同时写进 `chat_messages.payload`，历史回放直接用

> 注意：Python 进程必须能访问这个 URL。本地 demo 下 `localhost:3001` 没问题；若 Go 与 Agent 将来部署在不同机器，`PUBLIC_BASE_URL` 要填成对方可达的地址。

### 决策 3：返回结构改成真实接口的形状，同步改前端类型

不要为了迁就旧类型去伪造 `brightness/contrast/saturation/whiteBalance`。**以真实接口为准，改前端类型和卡片。** 新类型见第五节。

顺带解决一个体验问题：真实接口返回多个候选，前端可以做成**候选切换**（让用户挑一张最满意的），比现在"只有一张、不满意也没辙"要好。

### 决策 4：`passed=false` 走结构化结果，不走异常

`passed=false` 是**正常的业务分支**（拍摄环境不达标，引导用户重拍），不是错误。所以：

- tool 返回 `success: true` + `passed: false` + `error` 文案
- 这样 Agent 的 `_extract_tool_result()`（`agent.py` 第 247 行要求 `success` 为真）会正常捕获它，`message.type` 仍是 `correct`，前端可以渲染一个"环境不达标，请重拍"的卡片，而不是一句干巴巴的报错。

如果反过来返回 `success: false`，结果会被丢弃、退化成纯文本回复，用户就拿不到结构化的引导了。

### 决策 5：超时必须放宽，否则前端会先超时

这是最容易忽略、上线必炸的一条：

| 链路 | 当前值 | 问题 | 建议 |
|------|--------|------|------|
| 前端 → Go | **30s**（`chatService.ts` 的 `AbortSignal.timeout(30000)`） | 校色单项就 ~10s，加上 LLM 两轮往返（tool 调用前后各一次），很容易顶破 | **提到 90s** |
| Go → Agent | 60s（`chat_service.go`） | 够用 | 保持 |
| Agent → 校色接口 | 未设 | 必须显式设，且要留余量 | **60s + 失败重试 1 次** |

`elapsed_time` 示例已经 9.86s，遇到大图会更久。**建议先按 90s 调前端**，并给校色过程加一个 loading 态，别让用户以为卡死了。

### 决策 6：由 `feature` 决定「谁选 tool」——点了快捷按钮就不要经过 LLM

这是链路里容易被忽略的一环：**图片到了 Agent 之后，是谁决定调用 `image_correction`？**

| 入口 | `feature` | 谁决定调 tool | 图片进不进 LLM |
|------|-----------|---------------|----------------|
| 用户点「一键校色」按钮 | `"correct"` | **代码直接调**，不走 LLM | ❌ 不进 |
| 用户在输入框自由描述 | `null` | LLM 语义分析 | 看情况 |

**`feature` 非空时必须短路：** 既然已经知道要调 `image_correction`，就没有必要再让 LLM 判断一次 —— 既慢（多一轮往返）、又可能选错工具、而且还要把图片 URL 塞进 LLM 上下文。直接调，结果更快也更稳。

这正好呼应 `API.md` 里定的契约（「`feature` 非空时 Agent 确定性地调用映射的 Tool，不做语义判断」）。

**这一条同时决定了图片要不要进 LLM：** 快捷入口下图片根本不进 LLM，所以"非视觉模型 / 视觉模型"对这条主链路完全没有影响。

---

## 四、Tool 定义

已实现于 `agent/app/tools/color_tools.py`（替换原 stub）。下面是与设计相关的要点，**完整代码以文件为准**。

**配置项**（`agent/app/config.py`，可被 `.env` 覆盖）：

```python
# 图片校色服务（搭档提供的接口，见 doc/Color_Correction.md）
CORRECTION_API_URL: str = "https://api3.ququan.net/quality/api/quality_check"
CORRECTION_TIMEOUT: float = 60.0          # 调用校色接口的超时
CORRECTION_RETRY: int = 1                 # 失败重试次数（仅对超时/5xx 重试）
CORRECTION_DOWNLOAD_TIMEOUT: float = 30.0 # 下载 image_url 的超时
```

**结构**：三段式，每段职责单一，错误统一走 `CorrectionError`。

```python
class CorrectionError(Exception):
    """带 errorCode 的内部异常，用于统一错误出口"""
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _download_image(image_url: str) -> tuple[bytes, str, str]:
    """把 image_url 拉成字节。校色接口吃的是文件字节，不是 URL 也不是 base64。"""
    try:
        resp = httpx.get(
            image_url,
            timeout=httpx.Timeout(settings.CORRECTION_DOWNLOAD_TIMEOUT),
            # httpx 默认不跟随重定向，而 OSS / CDN 常有一次跳转，这里必须打开
            follow_redirects=True,
        )
        resp.raise_for_status()
    except httpx.TimeoutException as exc:
        raise CorrectionError("IMAGE_DOWNLOAD_TIMEOUT", "图片下载超时，请重试") from exc
    except httpx.HTTPStatusError as exc:
        raise CorrectionError("IMAGE_NOT_FOUND", f"图片获取失败（HTTP {exc.response.status_code}），可能已失效") from exc
    except Exception as exc:
        raise CorrectionError("IMAGE_NOT_FOUND", f"图片获取失败: {exc}") from exc

    if not resp.content:
        raise CorrectionError("IMAGE_NOT_FOUND", "图片内容为空")

    filename = image_url.split("?")[0].rstrip("/").rsplit("/", 1)[-1] or "image.jpg"
    content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    return resp.content, filename, content_type


def _call_correction_api(image_bytes: bytes, filename: str, content_type: str) -> dict:
    """multipart 转发给校色接口，返回原始 JSON 响应"""
    last_err = None
    for attempt in range(settings.CORRECTION_RETRY + 1):
        try:
            resp = httpx.post(
                settings.CORRECTION_API_URL,
                files={"image": (filename, image_bytes, content_type)},
                timeout=httpx.Timeout(settings.CORRECTION_TIMEOUT),
            )
            # 4xx 说明是我们的请求本身有问题（图不支持、参数错），重试没有意义
            if 400 <= resp.status_code < 500:
                detail = _extract_api_error(resp) or f"图片不被校色服务接受（HTTP {resp.status_code}）"
                raise CorrectionError("INVALID_IMAGE", detail)

            resp.raise_for_status()
            raw = resp.json()
            if not isinstance(raw, dict):
                raise CorrectionError("CORRECTION_FAILED", "校色服务返回了非预期的数据格式")
            return raw
        except CorrectionError as exc:
            last_err = exc
            if exc.code == "INVALID_IMAGE":
                break                      # 不可重试，直接跳出
        except httpx.TimeoutException:
            last_err = CorrectionError("PROCESSING_TIMEOUT", "校色服务响应超时，请稍后重试")
        except httpx.HTTPStatusError as exc:
            last_err = CorrectionError("CORRECTION_FAILED", f"校色服务返回 {exc.response.status_code}")
        except Exception as exc:
            last_err = CorrectionError("CORRECTION_FAILED", f"校色服务调用失败: {exc}")
    raise last_err or CorrectionError("INTERNAL_ERROR", "校色失败")


def _normalize_correction_response(raw: dict) -> dict:
    """把校色接口的原始响应归一化成前端 CorrectionResult 契约（见 API.md）"""
    candidates = [
        {
            "correctedImage": item.get("corrected"),
            "distance": item.get("distance"),
            "modelName": item.get("model_name"),
        }
        for item in (raw.get("results") or [])
        if isinstance(item, dict)
    ]
    return {
        "success": True,                       # 业务失败也算 success，见决策 4
        "passed": bool(raw.get("passed")),
        "originalImage": raw.get("original"),
        "candidates": candidates,
        "distance": raw.get("distance"),
        "threshold": raw.get("threshold"),
        "brand": raw.get("brand"),
        "deviceInfo": raw.get("device_info"),
        "elapsedTime": raw.get("elapsed_time"),
        "error": raw.get("error"),             # passed=false 时才有值
    }


@tool
def image_correction(image_url: str) -> dict:
    """图片一键校色工具（手机拍摄环境标准化校正）。

    何时使用：用户上传了一张照片，希望校正颜色、还原真实色彩、校准白平衡，
    或反馈照片「偏色 / 发黄 / 颜色不对」。

    Args:
        image_url: 待校正图片的完整可访问 URL，由后端在图片落盘后生成。
                   必须传 URL，不要传 base64。

    Returns:
        dict: 校色结果。passed=false 表示拍摄环境不达标，应引导用户重新拍摄。
    """
    try:
        image_bytes, filename, content_type = _download_image(image_url)
        raw = _call_correction_api(image_bytes, filename, content_type)
        return _normalize_correction_response(raw)
    except CorrectionError as exc:
        return {"success": False, "errorCode": exc.code, "error": exc.message}
    except Exception as exc:
        return {"success": False, "errorCode": "INTERNAL_ERROR", "error": f"校色失败: {exc}"}
```

**写代码时相对设计稿的三处收紧：**

1. **`follow_redirects=True`** —— `httpx` 默认**不**跟随重定向（和 `requests` 相反）。OSS / CDN 的图片 URL 常有一次跳转，不开这个开关会拿到 302 空 body。
2. **4xx 不重试** —— 原稿对任何失败都重试。但 4xx 是我们的请求本身有问题（图不支持、格式错），重试纯属浪费一次 10s 的等待，且会把真实原因盖成超时。现在 4xx 立即返回 `INVALID_IMAGE`，只有超时 / 5xx 才重试。
3. **把 URL / 超时提进 `config.py`** —— 原稿是模块常量，现在走 `settings`，切环境只改 `.env`。

**返回 `dict` 是可以的**：LangGraph 的 `ToolNode` 会对非字符串返回值做 `json.dumps(..., ensure_ascii=False)`（已确认 `langgraph/prebuilt/tool_node.py` 第 46 行 `msg_content_output`），所以 `agent.py` 里 `_extract_tool_result()` 的 `json.loads()` 能正常解析，中文也不会乱码。**已实测**：`ToolMessage.name = "image_correction"`、`content` 是合法 JSON 字符串。

**不需要新增 `app/storage.py`。** 选 URL 方案之后，Python 侧对存储零感知 —— 不用 `resolve_image()`、不用区分本地 / OSS，就是一个 HTTP GET。这是该方案最直接的收益。

> 内存提醒：图片会以字节形式在内存里走一遍（下载 → 上传）。按 10MB 上限估算没问题；若以后放开到几十 MB，建议改成流式转发或先落临时文件再上传。

### 4.1 本地验证脚本

`agent/scripts/test_image_correction.py` —— **不经 LLM、不经 Agent、不经 Go**，直接调 tool。

因为 tool 的入参是 URL 而测试图在本地磁盘，脚本会**临时起一个静态 HTTP 服务**把本地图变成 URL，这样测的就是生产同一条代码路径（真实 HTTP GET + multipart 转发），不必给 tool 加「本地路径」分支。

```bash
cd go-backend/agent
.venv/Scripts/python.exe scripts/test_image_correction.py            # 默认用 ColorAI/public/uploads/testimage.jpg
.venv/Scripts/python.exe scripts/test_image_correction.py <图片路径>
```

脚本会把 `original` 与所有 `corrected` 候选下载到 `go-backend/tool-test-output/`（已加 `.gitignore`），方便肉眼比对校色效果。

**实测结果（2026-09-15，testimage.jpg 443KB）：**

| 项 | 值 |
|----|-----|
| `passed` | `true` |
| `distance` / `threshold` | `0.2399` / `0.6` |
| `candidates` | 3 张 |
| `elapsedTime` | 5.7 ~ 6.3s |

三个错误分支也各验过一次：

| 输入 | 实际返回 |
|------|----------|
| 不可达地址 | `IMAGE_NOT_FOUND`（`图片获取失败（HTTP 502）`） |
| 404 | `IMAGE_NOT_FOUND`（`图片获取失败（HTTP 404）`） |
| 指向一个 txt 文件 | `INVALID_IMAGE`（`无法解码图片`，接口原话） |

> `INVALID_IMAGE` 这条很有价值：接口自己的错误体形如 `{"error":"无法解码图片"}`，`_extract_api_error()` 会把它取出来直接给用户，比我们自己编一句「校色失败」有用得多。

---

## 五、返回 Schema（新前端契约）

`ColorAI/src/types/index.ts` 改为：

```ts
export interface CorrectionCandidate {
  correctedImage: string;   // 校正后图片 URL
  distance: number;         // 该候选与标准环境的距离
  modelName: string;        // 校正所用模型
}

export interface CorrectionResult {
  success: boolean;
  passed: boolean;                  // false = 拍摄环境不达标
  originalImage: string;            // 原图 URL
  candidates: CorrectionCandidate[];// 候选校正图（可能多张）
  distance: number;                 // 原图与标准环境的距离
  threshold: number;                // 达标阈值
  brand?: string;                   // 检测到的品牌
  deviceInfo?: string;              // 设备描述
  elapsedTime?: number;             // 处理耗时（秒）
  error?: string;                   // passed=false 时的提示文案
}
```

`API.md`「消息类型说明」里 `correct` 那一行同步替换为上面这个结构。

---

## 六、错误映射

沿用 `python工具方协议.md` 的 `error_code` 约定，与「URL 方案」的实际情况对齐。注意错误来源有**两段**：先下载 `image_url`，再调用校色接口，两段各有各的失败码。

| errorCode | 触发场景 | 建议对用户的话术 | 会重试吗 |
|-----------|----------|------------------|----------|
| `IMAGE_DOWNLOAD_TIMEOUT` | 下载 `image_url` 超过 `CORRECTION_DOWNLOAD_TIMEOUT`（30s） | 图片读取超时，请重试 | ❌ |
| `IMAGE_NOT_FOUND` | 拉取 `image_url` 失败：404 / URL 已过期 / 网络不可达 / 空 body | 图片已失效，请重新上传 | ❌ |
| `INVALID_IMAGE` | 校色接口返回 **4xx**（图无法解码、格式不支持） | 直接用接口返回的文案（如"无法解码图片"） | ❌ |
| `PROCESSING_TIMEOUT` | 校色接口响应超过 `CORRECTION_TIMEOUT`（60s） | 校色服务繁忙，请稍后重试 | ✅ 1 次 |
| `CORRECTION_FAILED` | 校色接口 5xx / 网络异常 / 返回非 JSON | 校色服务暂时不可用 | ✅ 1 次 |
| `INTERNAL_ERROR` | 兜底（理论上走不到） | 校色失败，请重试 | ❌ |
| （无 errorCode） | `passed=false` | 直接用接口返回的 `error` 文案（如"拍摄环境不匹配，请重新拍摄"） | — |

注意 `passed=false` **不占用 errorCode**，它是 `success: true` 的正常业务分支。

**重试策略**：只对「超时」和「5xx」重试 1 次。4xx 是请求本身的问题，重试没有意义，而且校色接口单次 ~6-10s，白等一轮还会把真实原因盖成超时。下载失败也不重试（同一次对话里再拉一遍大概率还是失败）。

### 与「图片过期」的关系（重要，别混为一谈）

上表里的 `IMAGE_NOT_FOUND` 是**工具执行时**才发现 URL 拉不动 —— 也就是说这一轮对话里用户刚上传的图片就已经取不到了（正常不该发生，出现即说明存储侧有问题）。它对应的是「本轮失败」。

而用户说的「图片过期」是**另一个场景**：图片当年校色成功、结果也落库了，几个月后用户翻历史记录，此时 `originalImage` / `correctedImage` 这些**已经存进 `payload` 的 URL** 失效了。这个场景**根本不会走到工具**（不会重新调校色接口），前端渲染时 `onError` 直接切「已过期」占位图即可，见 §2.4。

一句话：**`IMAGE_NOT_FOUND` 是执行期错误，前端弹提示让用户重传；过期是展示期状态，前端换占位图。两者不共用一套 UI。**

---

## 七、端到端时序

```text
前端
 │  POST /api/chat  { messages:[{ role:user, feature:"correct", images:[dataURL] }] }
 ▼
Go 后端
 │  ① 解码 images → 落盘 uploads/chat/2026/09/15/abc.jpg
 │  ② 拼出完整 URL：{PUBLIC_BASE_URL}/uploads/chat/2026/09/15/abc.jpg
 │  ③ 用 URL 替换 images 字段，转发 Agent
 ▼
Python Agent
 │  ④ feature="correct" → 确定性调用 image_correction（不做语义判断）
 ▼
image_correction
 │  ⑤ httpx.get(image_url) → 拿到图片字节
 │  ⑥ multipart 上传到 api3.ququan.net
 │  ⑦ 归一化响应 → dict
 ▼
Agent
 │  ⑧ _extract_tool_result → message.type="correct", metadata=结果
 ▼
Go 后端
 │  ⑨ 落库（msg_type="correct" + payload=metadata，图片字段存 URL）
 ▼
前端
    ⑩ 按 message.type 渲染 correct 卡片（含候选切换）
    ⑪ 图片 onError → 重试一次 → 仍失败则显示"已过期"占位
```

第 ⑨ 步是目前**没做**的：`chat_service.go` 的 `saveMessages` 把 `msg_type` 恒写成 `"text"`、`payload` 恒写 `"null"`，导致刷新后卡片退化成纯文本。既然要动这条链路，建议一并修掉。

---

## 八、前端需同步改动

> ✅ 已全部完成（2026-09-15），实测记录见 §8.1。下面保留改动清单，方便对照。

| 文件 | 改动 |
|------|------|
| `src/types/index.ts` | 新增 `CorrectionCandidate`；`CorrectionResult` 换成第五节的新结构 |
| `src/pages/Workspace.tsx` | correct 卡片抽成独立组件 `CorrectCard`，渲染 `passed` / `distance` / `threshold` / `deviceInfo` / `elapsedTime`，去掉 `metadata.brightness` 等虚构字段 |
| `src/pages/Workspace.tsx` | 增加候选切换（`candidates.length > 1` 时），带 `参考机型` 显示 |
| `src/pages/Workspace.tsx` | 增加 `success=false` 与 `passed=false` 两种失败态卡片 |
| `src/pages/Workspace.tsx` | 所有引用 `correctedImage` 的地方改为 `candidates[0].correctedImage` |
| `src/pages/Workspace.tsx` | `MessageBubble` 结尾的 `return null` 改成「有文案就退化成文本气泡」，避免 metadata 缺失时整条消息渲染空白 |
| **新增** `src/components/SmartImage.tsx` | 统一图片加载失败处理：`onError` → 重试一次 → 仍失败显示"已过期"占位；用 `min-h` 预留布局，避免消息列表跳动 |
| `src/utils/workspace.ts` | `buildResultFields` 提到这里，供「实时对话」与「恢复历史会话」两条路径共用 |
| `src/hooks/useSession.ts` | `switchSession` 补上 `buildResultFields(type, metadata)` |
| `src/services/chatService.ts` | 超时 `30000` → `90000` |
| `src/API.md` | `correct` 的 metadata 结构同步 |

**`SmartImage` 的判定逻辑**（这是 2.4 那三条要求的落地）：

```tsx
// 失败后延时重试一次，只有连续两次都失败才判定为"已过期"
const [attempt, setAttempt] = useState(0);
const [status, setStatus] = useState<'loading' | 'retrying' | 'expired'>('loading');

const onError = () => {
  if (attempt === 0) {
    setStatus('retrying');
    setTimeout(() => { setAttempt(1); setStatus('loading'); }, 1500);
  } else {
    setStatus('expired');   // 展示"图片已过期"占位
  }
};
// <img key={attempt} …>  —— 换 key 强制重挂载，否则同一个 src 浏览器不会重新请求
```

所有展示图片的地方（原图、候选校正图、取色卡片里的校色图）都换成 `SmartImage`，这样过期兜底只有一处实现。

---

## 8.1 实测发现的两个 bug（都不是"没渲染出来"那么简单）

用户反馈「发送图片校色，快捷工具和聊天框两条路都渲染不出来，但接口有数据」。**实际是两条路各有一个独立的 bug**：

### Bug 1：实时发送时整页白屏 —— 读不存在的嵌套字段

老卡片直接读 `res.metadata.brightness`，而新接口返回的 metadata **根本没有 `metadata` 这一层**（它是扁平的 `{success, passed, candidates, …}`）。
于是 `res.metadata` 是 `undefined` → `Cannot read properties of undefined (reading 'brightness')` **抛在 render 阶段**。

项目里**没有 ErrorBoundary**，所以一崩就是**整个 React 树卸载 → 全白**，而不是"卡片渲染不出来"那么局部。

> 教训：**「接口有数据但页面空白」的第一反应应该是「卡片是不是读了不存在的字段」。**
> 这类错误在开发时会被 Vite 的 overlay 挡一下，但生产环境就是纯白屏。

### Bug 2：刷新 / 切换会话后卡片退化成纯文本 —— metadata 没被展开

`useSession.switchSession()` 从 DB 读回消息后，只做了 `content → text` 的映射，
**没有调用 `buildResultFields(type, metadata)`**。于是 `msg.correctResult` 始终是 `undefined`，
`type === 'correct'` 的分支不命中，消息掉到最后的分支渲染成纯文本 ——
用户看到的就是「**一堆带 `**` 星号的原始 markdown 文字**」。

修法：把 `buildResultFields` 提到 `src/utils/workspace.ts`，两条路径共用。
**这类"两处都要做"的映射最容易只做一处** —— 实时对话能渲染、刷新后就不行。

### 验证方式

用 `agent-browser` 跑真实浏览器（两条路径各跑一遍）：

| 路径 | 结果 |
|------|------|
| 点「图片一键校正」→ 上传 testimage.jpg → 发送 | 卡片正常，`卡片标题=["图片校色完成"]`、图片 2 张、方案按钮 3 个，**console 无任何 error** |
| 侧栏点击历史会话（刷新恢复） | 卡片正常渲染，含候选切换 |
| 点「方案 2」 | 图片 src 由 `corr_0_…IMG_9895_1_jpg.jpg` 切到 `corr_1_…indoor_804_15_.jpg`，参考机型同步更新 ✅ |

> `npx tsc --noEmit` 在这里是最强的静态证据：类型换了之后，任何残留的旧字段访问都会直接编译失败。

---

## 8.2 把 4 个 stub 工具从工具列表里摘掉（**Agent 曾把编造数据当结果返回**）

校色链路跑通后，为了确认"其余四个工具"的现状，直接打了一次 Agent：

```bash
curl -X POST http://localhost:8000/api/chat -H 'Content-Type: application/json' -d '{
  "messages":[{"role":"user","content":"帮我取色","feature":"pick","images":["http://localhost:3001/uploads/…jpg"]}]}'
```

返回：

```json
{"type": "pick",
 "metadata": {"success": true, "colors": [
   {"hex": "#FF5733", "ratio": 0.35}, {"hex": "#33FF57", "ratio": 0.25}, …]},
 "content": "取色完成！这张图片提取出的 5 个主色调如下（按占比从高到低）：…"}
```

`#FF5733 / #33FF57 / #3357FF` 正是 `color_extraction` stub 里**写死的假色值**，
而 LLM 还围绕它们写出了「主色调为**橙红（#FF5733）**，属于暖色系，视觉上偏活泼、有能量感」
这种看起来非常专业的分析。**用户完全无法分辨这是编的。**

这比"报错"严重得多：报错用户会重试，编造的数据会被当成真结论用下去（做色卡、定包装色）。

### 根因（两处，缺一不可）

| 位置 | 问题 |
|------|------|
| `agent/app/tools/color_tools.py` | `get_all_tools()` 把 5 个工具**全部注册**，其中 4 个是返回假数据的 stub |
| `agent/app/core/agent.py` | `SYSTEM_PROMPT` 把 5 个能力**全部宣传**为"你的专长"，主动诱导 LLM 调用它们 |

只改一处不够：只改提示词，LLM 仍可能从 `bind_tools` 里挑到 stub；只改注册，提示词还在承诺能力。

### 改法

1. **删掉 4 个 stub 函数**（它们的契约本来就是错的：入参 base64、出参结构与前端不一致，没有保留价值）。
2. `get_all_tools()` 只返回 `[image_correction]`。
3. `SYSTEM_PROMPT` 改为**只宣传已上线能力**，并显式列出未上线的 4 项 + 三条禁止：
   不得编造数值、不得用 `image_correction` 冒充其它功能、不得声称"已完成"未上线的操作。
4. 在 `color_tools.py` 末尾留一块说明：4 个能力各自的前置条件、**前端目标契约**
   （以 `src/types/index.ts` 为准）、以及"实现一个才注册一个"的顺序。

### 验证（4 个用例）

| 用例 | 期望 | 实测 |
|------|------|------|
| `feature=pick` + 图片 | 如实说未上线，不得给色值 | `type=text`、`metadata=null`，「智能取色功能目前还没有上线…也不能凭空给出数值——那样只会是不准确的编造结果」✅ |
| 自由输入「帮我取色」+ 图片 | 同上，且**不得改做校色** | `type=text`、`metadata=null`，并主动引导"如果你的诉求是照片颜色不准，可以先试试一键校色" ✅ |
| `feature=correct` + 图片 | 回归：仍出 `correct` 卡片 | `type=correct passed=True 候选数=3` ✅ |
| 自由输入「照片偏黄，还原真实颜色」 | 回归：LLM 语义路由到 `image_correction` | `type=correct passed=True 候选数=3` ✅ |

外加全链路脚本 `scripts/test_chat_chain.py` 跑通（图片落盘 + URL 可达 + 落库 `type`/`metadata` 正确）。

> 教训：**"未实现的功能"绝不能以 stub 形式注册进工具列表。**
> 对 LLM 来说，一个返回 `{"success": true, ...}` 的 stub 和一个真实工具没有任何区别 ——
> 它会照用，并把假数据包装成专业结论。宁可让工具不存在，让它如实说"没上线"。

---

## 8.3 前端：未上线的功能置灰（避免"死路"）

§8.2 之后，点未上线的功能会得到一句诚实的「还没上线」—— 功能上没问题，但**体验上是死路**：
按钮照常可点，用户点进去才发现没有结果。

改法：把「是否已上线」收敛到**一处**，前后端一致。

| 文件 | 改动 |
|------|------|
| `src/constants/workspace.ts` | `FeatureItem` 新增 `available: boolean`；`correct` 为 `true`，其余 4 个为 `false`；新增 `isFeatureAvailable(key)` 查询函数；`DockItem` 同步带上 `available` |
| `src/components/workspace/ToolDock.tsx` | 常驻标签与「全部工具」面板：`disabled={!item.available}` + 置灰样式 + **「开发中」角标** + `title` 提示；`onClick` 加守卫 |
| `src/pages/Workspace.tsx` | `handleDockSelect` 加防御性守卫（`!isFeatureAvailable(item.key)` 直接 return），保证任何入口都选不中未上线功能；`ResultActions` 的「去取色」按 `isFeatureAvailable('pick')` 门控 |

**`ResultActions` 的连带修正**：原来 `if (!primary) return null` —— 一旦取色不可用、
「去取色」不再生成，**整个底栏（含「返回首屏」）会一起消失**。

> 后续（2026-09-15）用户明确要求**去掉「返回首屏」按钮**（原话「没啥用」）：
> 校色卡片自带「下载校正图」，渲染完就是终点，不需要再塞一个"重新开始"的出口。
> 所以现在的规则是：**`primary` 为空就整条底栏不渲染**（`if (!primary) return null`）。
> 连带删除了 `onReset` prop、`handleReset` 包装函数与 `ArrowLeft` 导入（都只服务于这个按钮）。

> 这样"后端实现一个工具"→ 前端只需把 `available` 改成 `true`，两处入口同时打开，
> 不需要再改 UI 代码。**唯一的可用性来源是 `FEATURES`，别再在组件里写死判断。**

### 验证（`agent-browser` 实测）

```
1) 工具坞按钮状态:
   [{"图片一键校正",禁用:false},
    {"智能取色器开发中",禁用:true},
    {"色彩空间转换开发中",禁用:true},
    {"颜色相似度对比开发中",禁用:true},
    {"手机拍摄校色开发中",禁用:true}]
2) 跑一次校色后的卡片底部按钮: []               ← 底栏整条不渲染（无「去取色」也无「返回首屏」）
   卡片内保留: 「下载校正图」
3) 卡片标题: ["图片校色完成"]
4) console: 仅 vite 连接日志 + React DevTools 提示，无 error
```

静态检查：`npx tsc --noEmit` 与 `npm run lint` 均 0 错误。

> `agent-browser` 踩坑补充：**每次调用都是全新的浏览器上下文，localStorage 不保留**，
> 不带登录直接 `open /workspace` 时页面外壳照常渲染，但所有 `/api/*` 都是 401，
> 前端只显示含糊的「AI 服务暂时不可用」—— 容易误判成后端挂了。
> 判据是看 Go 日志是不是 401。登录必须和后续操作写在同一次调用里。

---

## 九、待与搭档确认的开放问题

按重要性排序：

1. **`f3.ququan.net/temp/check/...` 的有效期具体多长？** 我们已决定接受过期、由前端显示占位，但仍需知道时长 —— 用来判断"过期占位"会多频繁地出现，以及要不要给用户一个"重新生成"的入口。
2. **接口是否需要鉴权？** 文档里没有 Header 说明，也没有 API Key。生产环境是否有白名单 / 签名？
3. **我们自己的 `uploads/` 保留多久？** 原图目前无清理策略，会无限堆积。PRD 提到原图 7 天清理 —— 需要确认由谁执行（Go 定时任务？）。
4. **`passed=true` 时 `results` 是否保证非空？** 需要确认，否则前端要处理空候选。
5. **多个候选怎么选？** 按 `distance` 升序取第一个，还是有别的推荐规则（示例里 `model_name` 对应不同机型）？
6. **图片限制**：支持格式（JPEG/PNG/WebP？）、最大体积、最大分辨率。
7. **`elapsed_time` 单位确认**是秒（9.86 看着像秒）。
8. **是否有并发 / QPS 限制？** 影响是否需要加限流。
9. **网络可达性**：`api3.ququan.net` 是否需要内网 / VPN 才能访问？本地 demo 能不能直连？

---

## 十、落地步骤

按依赖顺序，每步都可单独验证：

1. **对齐契约** —— 本文档第五节的新 `CorrectionResult` + 第九节的开放问题，先跟搭档确认，冻结结构。
2. ✅ **重写 `image_correction`** —— 已完成（2026-09-15）。见第四节 + 4.1 的实测结果。
3. ✅ **Go 侧收图落盘** —— 已完成。见 10.1。
4. ✅ **Agent 侧 `feature` 短路** —— 已完成。见 10.1。
5. ✅ **前端契约与卡片** —— 已完成并实测通过（含 `SmartImage` 过期兜底）。见第八节 + 8.1。
6. ✅ **落库补 type/metadata** —— 已完成。见 10.1。
7. ✅ **超时放宽** —— 已完成：前端 90s（`chatService.ts`）、校色接口 60s、图片下载 30s。

**V1.0 的校色链路已全通。** 第 2 步是关键节点：先用一个真实图片 URL 把 tool 本身跑通、再接 Agent，
这样出问题能立刻区分是"接口/网络问题"还是"Agent 编排问题"。✅ 已按此验证。

---

## 10.1 后端链路已完成并实测通过（2026-09-15）

### 改了哪些文件

| 文件 | 改动 |
|------|------|
| `go-backend/config/config.go` | 新增 `StorageConfig`（`Driver` / `LocalDir` / `PublicBaseURL` / `MaxUploadBytes`） |
| `go-backend/service/storage.go` | **新建**。`Storage` 接口 + `localStorage` 实现（dataURL → 落盘 → URL） |
| `go-backend/service/chat_service.go` | 新增 `resolveImages()`；`saveMessages` 改为落真实 `msg_type` 与 `metadata` |
| `go-backend/app.go` | 组装 `Storage` 并注入 `ChatService`；建目录改用 `cfg.Storage.LocalDir` |
| `go-backend/router.go` | 静态路由改用 `service.UploadURLPrefix` + `cfg.Storage.LocalDir`，消除两处硬编码漂移 |
| `go-backend/.env.example` | 新增 `STORAGE_DRIVER` / `UPLOADS_DIR` / `PUBLIC_BASE_URL` / `MAX_UPLOAD_BYTES` |
| `agent/app/core/agent.py` | `FEATURE_TOOL_MAPPING` 短路；图片改以 URL 形式随文本给 LLM；保留 assistant 历史 |
| `ColorAI/src/services/chatService.ts` | 超时 `30000` → `90000` |
| `go-backend/scripts/test_chat_chain.py` | **新建** 端到端联调脚本 |

### 关键实现点

**① Go 侧 `resolveImages()` 是「图片永不进入 Agent」的落地点。** 在转发给 Agent 之前把 dataURL 换成 URL，**落盘失败直接返回错误、不静默降级** —— 否则 tool 拿不到图，用户会看到莫名其妙的校色失败。

**② 静态路由与存储前缀统一。** 原来 `router.go` 硬编码 `/uploads` + `filepath.Join(".", "uploads")`，而 `storage.go` 也要拼同一套路径，两边容易漂移。现在两处都从 `config.Storage` 取，`UploadURLPrefix` 是共享常量。

**③ Agent 侧不再把图片字节塞进 `HumanMessage`。** 原实现用 `_to_data_url()` 把图片作为 `image_url` content part 注入 —— 改成 URL 方案后这个函数会把 `http://...` 误拼成 `data:image/jpeg;base64,http://...`，直接产生垃圾。现在改为把 URL 作为文本附在消息里（tool 的入参是 URL，而 LLM 只能通过文本生成 tool 参数，所以 URL 必须在文本里）。**顺带的好处：不再要求模型支持视觉，也不白烧 token。**

**④ `feature` 短路后仍让 LLM 写总结，但用不带 tools 的 LLM。** 短路时手工补一对 `(AIMessage.tool_calls, ToolMessage)` 再调 `self.llm.ainvoke()`（**不是** `llm_with_tools`）—— 这样工具选择权不在 LLM 手里，LLM 也拿不到工具、不会重复调用。实测 DeepSeek 接受"带 `role: tool` 消息但不传 `tools` 参数"的请求。

**⑤ `FEATURE_TOOL_MAPPING` 只登记已实现的工具。** 未实现的工具**连注册都不注册**
（见 §8.2），自然也不会登记短路映射。实现一个 → 注册一个 → 登记一个。
登记顺序有讲究：只登记「图片参数是 URL」的工具，参数不匹配的短路过去会直接报错。

### 端到端实测（`scripts/test_chat_chain.py`）

跑法：`cd go-backend && go run .`（会自动拉起 Python Agent），另开一个终端跑脚本。

```
[1] 登录成功 user=testuser
[2] 会话 id=session-3d478b65ed0fe6fe
[3] dataURL 长度 591 KB（原图 443 KB）
[4] /api/chat 返回 200，耗时 14.8s
    type=correct  passed=True  candidates=3
[5] 校验图片落盘与 URL 可达性
    落盘文件: uploads\chat\2026\09\15\20260915_151545_7313d5dfc583f377.jpg (443 KB)
    URL http://localhost:3001/uploads/chat/2026/09/15/...jpg
      → HTTP 200, 443 KB, image/jpeg
[6] 校验会话持久化
    role=user      type=text     附加字段=['feature', 'images']
      images[0] = http://localhost:3001/uploads/chat/2026/09/15/...jpg  (URL ✓)
    role=assistant type=correct  附加字段=['metadata']
      metadata.passed=True 候选数=3 distance=0.2399
```

**四项都验到了：** 图片落盘（443 KB，与原图一致）、URL 可访问（HTTP 200 + `image/jpeg`）、
落库的 `images` 是 **URL 而不是 base64**、AI 回复的 `type`/`metadata` 正确。

另外单独验过 Agent 的三条路径：`feature=correct` 短路、`feature=null` 自由输入（LLM 语义路由到
`image_correction`）、多轮历史（问"我叫什么名字"能答出前文，说明 assistant 轮次不再被丢弃）。

### ⚠️ 目前唯一堵点：前端卡片还认旧结构

> ✅ **已修复（2026-09-15）**，详见 §8.1。当时的情况是：`ColorAI/src/types/index.ts` 的
> `CorrectionResult` 仍是旧形状，`Workspace.tsx` 直接读 `res.correctedImage` 和
> `res.metadata.brightness / contrast / saturation / whiteBalance` —— 新接口一个都不返回。
> 后端已通、前端未跟上，于是「接口有数据但页面白屏」。

