# 酷家乐 Skill 接入与 AI 装修模块技术路线评估

> **文档性质**：技术方案评估（调研结论 + 接入设计 + 路线评估 + PoC 设计）
> **状态**：待评审
> **日期**：2026-10-09
> **事实基础**：ai-kujiale-design v0.0.6 全包审查（34 个文件）+ 真实探针实测（杭州/湘潭两城市样本）+ 多轮决策讨论
> **关联文档**：[智能体接口演进设计.md](智能体接口演进设计.md)（异步任务范式前置）、[RAG知识库设计.md](../agent/doc/RAG知识库设计.md)（色彩推荐能力底座）

## 0. 一句话总结

酷家乐 Skill 提供的是「**生成链路**」（户型 → 风格 → 布局 → 渲染出图），可 100% Python 原生化接入，零新依赖；但用户期待的「3D 自由视角 + 点选换色」属于**编辑器级体验**，不在 API 能力范围内。建议分层实现：**生成借酷家乐、换色预览自研（色彩 AI 差异化）、3D 深度编辑交由酷家乐平台承接**。

---

## 一、背景与目标

- **业务目标**：以酷家乐 AI 设计能力为地基，把「AI 装修」做成 ColorAI 未来的重点模块。
- **输入形态**：调接口搜索到的户型（小区名 → 户型库）与用户上传的户型图，两者都要支持。
- **目标体验（远景）**：生成 2D/3D 装修效果图；3D 自由视角查看；点击地板/墙面/家具推荐颜色；点击颜色即时替换预览。
- **本文覆盖**：① Skill 接入设计（生成链路）② 模块技术路线评估（交互升级）③ PoC 设计方案。

---

## 二、调研与实测结论（事实基础）

### 2.1 Skill 是什么

| 项 | 内容 |
|---|---|
| 包 | `wuweiqi1993/ai-kujiale-design` **v0.0.6**，SKILL.md author = **ManycoreTech（群核科技=酷家乐母公司）**，MIT-0 许可 |
| 审核 | ClawHub 平台审核 clean、VirusTotal clean、LLM 安全审查无恶意载荷（仅提示密钥卫生问题） |
| 形态 | **OpenClaw 专用技能包**：SKILL.md 流程规范 + 15 个 Node.js 脚本 + 13 份接口文档 + city.json + outputs 模板 |
| 关键事实 | **零浏览器依赖、零 npm 依赖**——所有脚本都是 Node 原生 https 的薄封装，全部是纯 HTTPS JSON 调用 |
| 同名包警告 | ClawHub 上有两个同名包（wuweiqi1993 官方作者版 / thcjp 第三方衍生版），安装/下载必须指名 owner |

> 命名提醒：官方安装指令 `clawhub install ai-kujiale-design` 不限定 owner；实际安装建议 `clawhub install wuweiqi1993/ai-kujiale-design`，避免装错衍生版。

### 2.2 完整接口清单（审查 15 个脚本后整理，比文档多暴露 5 个端点）

**主域 `oauth.kujiale.com`**（绝大多数接口用 `access_token` 查询参数鉴权）：

| 阶段 | 接口 | 说明 |
|---|---|---|
| 护栏 | `GET .../version/check` | 版本校验（action：0 通过 / 1 过时可用 / 2 禁用） |
| 1 户型 | `GET .../floorplan/standard/search` | 小区户型搜索 → planId 列表 |
| 1 户型 | `POST .../design/creation` | 创建装修方案 → designId |
| 1 户型 | `POST .../bitmap/import/async` | 户型图临摹导入 → taskId |
| 1 户型 | `GET .../bitmap/floorplan-import/status` | 临摹轮询（-2=进行中）→ planId |
| 2 风格 | `GET .../tag/list` | 偏好标签列表 |
| 2 风格 | `POST .../style/list` | 硬装风格（body 传 tagItemIds）→ styleId |
| 3 布局 | `POST .../customize-layout` | **触发智能布局（核豆扣费点）** |
| 3 布局 | `GET .../vip` | 核豆/会员状态（余额不足时取充值链接） |
| 3 布局 | `GET .../design/layout-res` | 布局结果（房间 + 家具清单） |
| 3 布局 | `GET .../layout/candidateList` | 候选布局（脚本实测参数名为 obsDesignId，与文档不一致） |
| 4 渲染 | `GET .../factory/api/design/get` | 取 levelId（**Bearer 鉴权**） |
| 4 渲染 | `POST .../auto-camera` | 触发智能视角匹配（Bearer，bizprefix=design-factory） |
| 4 渲染 | `POST .../render/submit` | 批量提交渲染任务（Bearer）→ taskIds |
| 4 渲染 | `GET .../renderpic/list` | 渲染图列表 → img + panoLink |

**`www.kujiale.com`**：
- `GET /api/designinfo/floorplans?planid=` —— 户型图信息，**免鉴权**（含平面图 URL、面积、户型评分）
- `GET /rcs/interface/api/c/common/autocamera/secure/status` —— 相机就绪轮询（**Bearer 鉴权**，status=2 完成）

**OUS 上传链路（5 个接口）：可整体跳过**。原设计是为了 OpenClaw 场景"本地文件 → 公网 URL"；ColorAI 的图片已落 OSS 公网 URL，直接传给 `bitmap/import/async` 的 `bitmap` 参数即可（要求 URL 以小写图片格式后缀结尾，接入时需核对我们 OSS key 规则）。

### 2.3 鉴权与响应约定

- **双鉴权模式**：大部分接口 = `access_token` 查询参数；渲染链路（design/get、auto-camera、render/submit、RCS 相机状态）= `Authorization: Bearer <token>`（同一个 token 值）。
- **响应统一封装**：`{c, m, d}`，`c="0"` 为成功。
- **access_token 即 Skill Key**：用户在 `kujiale.com/skills` 获取，绑定其酷家乐账号。

### 2.4 渲染链路（trigger-render.js 解构）

```
① design/get 取 levelId
② auto-camera 并行触发两种视角匹配（普通=1 / 全景=2）
③ 轮询相机状态（默认 10 次 × 3s）→ 状态 2 → 提取 shotType===3 的视角
④ 业务筛选：普通图 每房≤2张 / 每类房间≤3 / 总≤6；
             全景图 每房≤1张 / 每类房间≤2 / 总≤4
   房间优先级：客餐厅 → 卧室类 → 厨房 → 书房 → 卫生间 → 阳台 → 其他
⑤ render/submit 批量提交（普通=快照类型 720/1k、全景=745/2k；
   灯光与外景为固定常量 ID）
⑥ 出图轮询：10 秒后开始查 renderpic/list，每分钟重试，超 5 分钟报失败
```

### 2.5 费用点（仅两处）

| 动作 | 费用 | 识别方式 |
|---|---|---|
| 智能布局（customize-layout） | **扣核豆** | `c≠0` 且 `m="个人商业化功能余额不足"` → 查 `/vip` 接口拿官方充值链接 |
| 渲染出图 | 消耗账号额度（skill-card 口径） | 提交/查询失败信息 |
| 其余（搜索/临摹/风格/查询） | 免费 | — |

### 2.6 真实探针实测（2026-10-09）

探针脚本：`agent/scripts/test_kujiale_skill.py`（零依赖、token 走环境变量、只调用免费无副作用接口）。

| 样本 | 全库 | 标准库（is_standard=true） | 备注 |
|---|---|---|---|
| 杭州 / 申花壹号院 | 175 条 | 72 条 | 开发商规范命名（"89.00㎡B偶数层户型3室2厅"） |
| 湘潭 / 花园 | 334 条 | 106 条 | 全库混 UGC 脏数据；标准库为开发商命名 |

- 三个核心接口全部实测通过，token 有效；
- 户型图信息接口（免鉴权）返回平面图 + 面积 + **户型评分**（杭州样本：总分 87 / 动线 32 / 分区 30 / 通风 25）；
- **户型库覆盖结论**：大城市密集、三四线也有开发商标准数据，"报小区名出户型"的体验在中东部城市普遍成立。

### 2.7 实测发现的 6 个坑（实现时必须处理）

1. **version/check 恒返回 action=1**（即使 isLastest=true、latestVersion=当前版本）→ 实现时**只拦 action==2**，不把 1 当异常。
2. **搜索结果 `commName` 实测恒为 null**（文档示例有值）→ 小区名从 `name` 字段解析，勿依赖 commName。
3. **搜索 `srcArea` 与户型图接口实际建面差 2~9%**（同户型 89㎡ vs 97㎡）→ 展示标注"参考面积"。
4. **`allScore` 户型评分可能全 0** → 按"未评分"容错展示。
5. **全库混有 UGC 脏数据**（"郭姐""B装修设计方案"）→ **默认加 `is_standard=true`** 只取标准库（这是官方 skill 没做、我们应做的质量提升）。
6. **city.json 仅省+市两级**（无区县）→ `area_id` 粒度到地级市（杭州=175、湘潭=277）。

### 2.8 安全事项

- Skill Key **禁止明文入库/入库文档/进日志**；只放 `agent/.env`（如 `KJL_ACCESS_TOKEN=`）或数据库加密列。
- ClawHub 安全审查特别点名该 skill 的密钥卫生问题（token 走命令行参数与 URL 查询参数）——我们实现时 **loguru 日志必须对 URL 做 token 脱敏**。
- 该 Key 曾短暂出现在本地文档中（已清除）；若曾提交过任何远端（Git/SVN），建议去控制台轮换。

---

## 三、ColorAI 接入设计（阶段一：生成链路）

### 3.1 总体架构

```
用户 ←→ ColorAI 对话（Workspace）
            │
            ▼
  Python Agent 新工具族（kujiale_*）
            │  access_token 查询参数 / Bearer 头（同值）
            ▼
  oauth.kujiale.com + www.kujiale.com（httpx 直连，零新依赖）
            │
            ▼
  交付物：户型图 / 户型评分 / 风格封面 / 布局清单 / 效果图组 / 全景链接 / 方案详情链接
                                                    │
                        深度编辑（3D 自由视角、点选换材质换色、重渲染）→ 跳转酷家乐编辑器
```

### 3.2 工具拆分（细粒度 8 个，配 prompts 流程指引）

| 工具 | 对应接口 | 说明 |
|---|---|---|
| `kujiale_search_plan` | floorplan/standard/search | 默认 `is_standard=true`；city → areaId 用内置 city.json |
| `kujiale_import_plan` | bitmap/import/async + 轮询 | 入参为用户图片 URL（OSS 公网）；内部轮询 |
| `kujiale_create_design` | design/creation | planId → designId |
| `kujiale_get_tags` | tag/list | 偏好标签 |
| `kujiale_get_styles` | style/list | 按 tagItemIds 出风格（含封面图） |
| `kujiale_trigger_layout` | customize-layout | **核豆确认后才允许调用**；余额不足返回充值引导 |
| `kujiale_get_layout` | design/layout-res | 房间 + 家具清单 |
| `kujiale_render` | trigger-render 链路 + renderpic/list | 视角匹配 + 提交 + 出图查询（长任务，见 3.5） |

- **形态定位**：自由输入工具族（LLM 语义触发），**不进 `FEATURE_TOOL_MAPPING`**（多轮流程不适合 feature 确定性短路），MVP 不占工具坞入口。
- **会话状态**：`planId → designId → styleId/tagItemIds` 都是短字符串，由 LLM 从对话历史携带即可（skill 原生做法）；如要更稳，可在 agent 侧存会话态（二期再做）。
- **提示词**：把 SKILL.md 的 4 阶段流程压缩进 `prompts.py`（含 3 个确认点），同步更新 `test_system_prompt.py` 护栏。

### 3.3 四个确认点交互（沿用 skill 的强制设计）

1. 户型确认（展示户型图）
2. 风格选择（封面图单选）
3. **核豆确认（布局前，硬确认）**
4. 渲染等待说明（"预计几分钟"）

### 3.4 关键实现决策

| 决策 | 结论 | 依据 |
|---|---|---|
| 接入方式 | Python 原生化重写（httpx） | 全链路纯 HTTP，零浏览器/零 npm；与现有 5 个工具形态一致 |
| 搜索结果过滤 | 默认 `is_standard=true` | 实测规避 UGC 脏数据（§2.7-5） |
| 上传链路 | 跳过 OUS，直喂 OSS URL | 图片已在 OSS 公网可达（需小写后缀） |
| 错误处理 | 绝不 raise；`success=false + errorCode` | 项目工具铁律；余额不足单独识别 |
| 结果展示 | MVP：`type=text` + Markdown 图片 | 复用前端 SmartImage/ImageLightbox；专属卡片二期契约先行 |
| 日志 | URL token 脱敏 | 安全审查点名问题 |
| 版本护栏 | 移植 versionCheck，只拦 action==2 | §2.7-1 |
| 效果图持久化 | 先直连 CDN URL；观察过期情况再决定 OSS 转存 | 酷家乐 CDN 大致长期有效，需实测 |

### 3.5 两个前置条件（不解决则不可上线）

**前置 1：异步任务范式（工程）**
全流程 3~10 分钟（临摹轮询 + 布局 10s 级 + 视角匹配 30s+ + 出图分钟级），远超 Go 侧 60s 同步超时。
- 方案 A（推荐）：先落地《智能体接口演进设计》的阶段一（任务态消息 + 轮询）
- 方案 B（降级）：把轮询摊进多轮对话（每轮查一次），体验差但零改造

**前置 2：多租户 token（产品决策）**
核豆消耗在 token 所属的酷家乐账号上，三种模式：

| 模式 | 说明 | 代价 |
|---|---|---|
| a. 运营账号单 token | 全站共用运营核豆 | 成本自担，量大不可持续；仅适合内测 |
| b. 用户各自绑定 | 用户注册酷家乐并获取自己的 key，在 ColorAI 绑定 | 需用户体系扩展 + Go→Agent 协议带用户 token + 加密存储；正规但工作量大 |
| c. 企业开放平台 | 走 open.kujiale.com 商务合作 | 需商务谈判；可能有企业计费/嵌入方案 |

**建议**：内测用 a；产品化走 b 或 c。协议设计**预留 user_token 扩展位**，避免后期返工。

### 3.6 实施步骤（阶段一）

1. 拍板前置 2（多租户模式）→ 协议预留扩展位
2. 落地前置 1（异步范式阶段一，引用《智能体接口演进设计》）
3. 按项目标准三步接入工具族（工具文件 + `get_all_tools()` + `prompts.py` + `test_system_prompt.py` 护栏）
4. 探针脚本已就位（`agent/scripts/test_kujiale_skill.py`），联调先行
5. 前端联调（Markdown 图片渲染已具备，无需新组件）

---

## 四、AI 装修模块技术路线评估（体验升级）

### 4.1 需求拆解与可行性分级

| 能力 | 可行性 | 实现依据 |
|---|---|---|
| ① 户型图 → 2D/3D 效果图生成 | ✅ 已具备 | 阶段一生成链路（搜索/上传 → 布局 → 渲染） |
| ② 3D 任意视角 | 🟡 部分具备 | 全景链接（定点 360°）已有；自由漫游 = 编辑器级 |
| ③ 点击地板/墙面/家具 → 推荐颜色 | ✅ 差异化主场 | 分割模型 + **RAG 色彩知识库**（别人没有的能力） |
| ④ 点击颜色 → 即时替换预览 | 🔴 最难 | 见 4.2 成本陷阱 |

### 4.2 成本陷阱（必须先说清）

**"即时换色"绝对不能走"调 API 重新渲染"**：skill/API 层面**没有材质替换接口**（布局仅接受风格级参数，渲染是批量静态任务）——点一次颜色重渲染一次 = 每次核豆 + 分钟级等待。

即时预览只有三条路：**借用酷家乐编辑器**（原生支持）、**2D 图像重着色**（近似）、**自建 3D 编辑器**（重做一个垂直酷家乐）。

### 4.3 三条路线对比

| 维度 | 方案 A：借船（深链/嵌入酷家乐） | 方案 B：2D 重着色 + 色彩 AI | 方案 C：自研实时 3D 编辑器 |
|---|---|---|---|
| 体验 | 完整（=酷家乐编辑器：3D、点选换色、重渲染） | 效果图上"点选 → 推荐 → 即时换色"；无 3D 旋转 | 完整但自建 |
| 开发成本 | ~0（深链已有）；嵌入需商务合作 | 单人 1~2 个月级 | 年级工程量 + 团队 + 模型版权采购 |
| 单次成本 | 用户核豆 | 单图推理秒级，近乎零 | GPU 农场 + 海量素材运维 |
| 差异化 | 无（跳出去、品牌是酷家乐的） | **★★★★★ 颜色推荐是护城河** | 无（正面硬刚不可能赢） |
| 结论 | **近期采用** | **中期重点（色彩灵魂）** | **现阶段不成立** |

**方案 C 不成立的核心原因**：酷家乐的四层资产（户型库 / 2.7 亿模型素材 / 实时渲染引擎 / 光追农场）是十年积累，自建同量级不可能；正确姿势是"在色彩智能这一层做深"。

**折中补充（B 的升级件，数周级）**：three.js 轻量 3D「配色沙盘」——户型挤出简约 3D（墙体 + 地面 + 简化家具盒体），**实时改墙/地颜色 + 任意旋转视角**，秒级零成本。它是示意级（非效果图），但与色彩 AI 推荐天然一对：沙盘里定配色 → 一键用酷家乐出真实效果图。

### 4.4 路线图

```
近期（现在）：A —— 生成走 Kujiale skill，深度编辑深链回酷家乐（0 开发，马上可用）
中期：B + 配色沙盘 —— 效果图"点选换色 + 色彩 AI 推荐"（差异化灵魂）
远期：视业务规模 —— 谈酷家乐"内部系统嵌入设计工具"合作（A 的升级）；
      自研 C 仅在有大投入时考虑，否则永远借船
```

### 4.5 免费获客体验（顺手可做，0 核豆）

| 体验 | 接口 | 价值 |
|---|---|---|
| 户型搜索器 | floorplan/standard/search | "报小区名就出户型"的魔法入口 |
| 户型测评卡 | designinfo/floorplans（免鉴权） | 平面图 + 户型评分（动线/分区/通风） |
| 风格灵感库 | tag/list + style/list | 拉新钩子 |

---

## 五、方案 B PoC 设计（验证"点选换色"质量）

**目标**：验证「点击效果图元素 → 换色预览」的实际质量，判定 B 方案是否值得正式投入。

**输入**：一张酷家乐渲染效果图（已有真实样本可用）。

**步骤**：
1. 点击坐标 → 分割模型（SAM 类）输出该元素 mask
2. mask 区域分类：地板 / 墙面 / 家具（CLIP zero-shot 或位置 + 面积 + 色分布规则）
3. 推荐色：接入现有 RAG 色彩知识库生成候选色卡（含推荐理由）
4. 重着色：保亮度色调迁移（LAB 空间换 a/b 通道），输出预览图

**验收标准**：
- ① 分割边缘质量：无溢出 / 无遗漏
- ② 平涂区域（墙/地）换色自然度：肉眼无色差感
- ③ 花纹家具换色失真度：可容忍（需截图评审定阈值）
- ④ 单图端到端耗时 < 5s

**成本**：约 1 周 PoC；推理复用现有推理链路或云分割 API（单次几分钱级）。

**决策点**：①②达标、③可容忍 → 正式投入 B 方案开发。

---

## 六、决策点与待办清单

### 需要拍板的决策

| # | 决策 | 建议 |
|---|---|---|
| 1 | 多租户 token 模式（a/b/c） | 内测 a → 产品化 b 或 c；协议预留扩展位 |
| 2 | 异步范式：先落地阶段一 or 降级多轮轮询 | 先落地（引用《智能体接口演进设计》） |
| 3 | 搜索默认 `is_standard=true` | 采纳（实测依据 §2.7-5） |
| 4 | MVP 展示形态：text + Markdown 图片 | 采纳；专属卡片二期契约先行 |
| 5 | 是否启动 B 方案 PoC | 建议启动（成本低、答案一周可见） |
| 6 | 是否咨询企业开放平台 | 建议咨询（嵌入设计工具 / 材质渲染接口 / 企业计费） |

### 待办

- [ ] 联系 open.kujiale.com 咨询：①"内部系统嵌入设计工具"形态与商务条件；②材质/局部渲染类接口是否开放；③企业版计费模式
- [ ] 拍板多租户模式 → 更新 Go↔Agent 协议设计（如需）
- [ ] 落地异步任务范式阶段一（见《智能体接口演进设计》）
- [ ] 启动方案 B PoC（如决策通过）
- [ ] Skill Key 入库位置确认（agent/.env），如曾暴露远端则轮换

---

## 附：参考与素材

| 项 | 位置/链接 |
|---|---|
| Skill 包（本地审查副本） | `D:\temp\kjl-skill\ai-kujiale-design`（34 文件） |
| 探针脚本 | `go-backend/agent/scripts/test_kujiale_skill.py` |
| Skill 官方页 | https://www.kujiale.com/skills |
| ClawHub 页面 | https://clawhub.ai/wuweiqi1993/skills/ai-kujiale-design |
| 企业开放平台 | https://open.kujiale.com |
| 接口契约（包内文档） | skill 包 `docs/*.md`（13 份） |
| 流程规范（包内） | skill 包 `SKILL.md`（4 阶段 17 步） |

> ⚠️ 本文与探针脚本均不含任何密钥；Skill Key 只允许存在于 `agent/.env` 或数据库加密列。
