/**
 * DeepSeek AI 服务模块
 * - 封装与 DeepSeek API 的对话调用
 * - 支持色彩智能体的 System Prompt
 * - 降级策略：后端代理 → Mock 回复
 *
 * 安全说明：
 *   API Key 仅在服务端使用，客户端不存储任何密钥。
 *   如需接入真实 DeepSeek API，请搭建后端代理服务，
 *   将密钥放在服务端环境变量中，客户端通过 /api/deepseek/chat 转发。
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  fromMock: boolean;
}

const COLOR_SYSTEM_PROMPT = `你是曲泉AI，一个专业的色彩智能体。你的专长是：
1. AI 一键校色：帮助用户校正图片的白平衡、色彩还原
2. 智能取色：从图片中提取主色调，支持 HEX/RGB/HSL/CMYK/Lab 等格式
3. 色彩空间转换：在不同色彩空间之间精准转换
4. 颜色对比：量化两个颜色的相似度（ΔE）
5. 手机拍摄校色：还原手机照片的人眼视觉真实色彩

请用专业、简洁、友好的语气回答用户关于色彩的问题。
当用户询问色彩理论、校色技巧、设备选择、行业应用等问题时，给出准确、实用的建议。
回答时适当使用色彩相关的专业术语，但要解释清楚。`;

/**
 * 智能 Mock 回复（当后端代理不可用时降级使用）
 * 覆盖常见色彩问题关键词匹配
 */
function generateMockReply(userText: string): string {
  const text = userText.toLowerCase().trim();

  const knowledgeBase: Array<{ keywords: string[]; reply: string }> = [
    {
      keywords: ['偏黄', '发黄', '黄'],
      reply:
        '照片偏黄通常是白平衡设置不准确导致的。建议：\n\n1. **手动调整白平衡**：在相机中将白平衡设为"阴天"或手动设置色温（约 5500K）\n2. **使用曲泉AI 一键校色**：上传图片后选择"AI 校色"模式，系统会自动识别并校正色温\n3. **后期微调**：在 HSL 面板中降低黄色饱和度 -10~-15\n\n如果方便的话，可以上传一张偏黄的照片，我来帮你分析具体的校正方案。',
    },
    {
      keywords: ['偏红', '发红', '红'],
      reply:
        '照片偏红常见于以下几种情况：\n\n1. **闪光灯直射**：建议使用柔光罩或跳灯（反射到天花板）\n2. **传感器过载**：降低曝光补偿 -0.3~-0.5EV\n3. **后期调整**：在 HSL 中降低红色通道饱和度，或在曲线中微调红色通道\n\n使用曲泉AI 的「AI 一键校色」功能可以自动修正这类偏色问题，上传图片即可获得校正结果。',
    },
    {
      keywords: ['偏蓝', '发蓝', '蓝'],
      reply:
        '照片偏蓝通常是色温设置偏低或环境光偏冷导致的。建议：\n\n1. **提高色温**：将白平衡色温调高至 5500K-6500K\n2. **增加暖色调**：在后期中增加橙色/黄色饱和度\n3. **使用曲泉AI 校正**：选择"AI 校色"模式，系统会自动分析并修正\n\n如果是室内荧光灯下拍摄，建议使用相机的"荧光灯"白平衡预设。',
    },
    {
      keywords: ['偏色', '色偏', '色差', '不对'],
      reply:
        '照片偏色是常见问题，通常由白平衡设置不准确或环境光色温差异导致。建议按以下步骤排查：\n\n1. **确定偏色类型**：偏黄/偏红/偏蓝/偏绿？不同类型的修正方法不同\n2. **使用灰卡校准**：拍摄时使用灰卡可以获得准确的白平衡基准\n3. **使用曲泉AI 一键校色**：上传图片后选择"AI 校色"模式，系统自动识别偏色类型并修正\n4. **手动微调**：在后期 HSL 面板中，降低对应偏色通道的饱和度\n\n如果方便的话，可以上传一张偏色照片，我来帮你分析具体的校正方案。',
    },
    {
      keywords: ['人像', '肤色', '皮肤'],
      reply:
        '人像肤色校色要点：\n\n1. **白平衡准确**：使用灰卡或曲泉AI 自动白平衡校正\n2. **肤色范围**：在 HSL 面板中单独调整橙色/红色通道\n3. **明度调整**：提高肤色明度 +5~+10，避免肤色暗沉\n4. **饱和度控制**：红色通道饱和度不要过高（通常 -5~-10 更自然）\n\n使用曲泉AI 的「AI 一键校色」+「人像模式」可以获得更自然的肤色还原。',
    },
    {
      keywords: ['印刷', '色差', '色准'],
      reply:
        '印刷色彩管理的关键步骤：\n\n1. **色彩空间**：统一使用 CMYK 工作空间（如 GRACoL、SWOP）\n2. **屏幕校准**：定期用校色仪（Spyder/X-Rite）校准显示器\n3. **打样验证**：使用曲泉AI 的「颜色对比」功能，ΔE 控制在 3 以内\n4. **ICC 色彩配置**：为每种印刷介质使用对应的 ICC Profile\n\n曲泉AI 支持从 RGB 到 CMYK 的精准转换，并提供 ΔE 量化对比功能。',
    },
    {
      keywords: ['色值', '色卡', '取色', '提取'],
      reply:
        '使用曲泉AI 取色的方法：\n\n1. **上传图片**：点击上传或拍照按钮\n2. **选择「智能取色」功能**\n3. **自动提取**：系统自动分析图片主色调，输出 HEX/RGB/HSL/CMYK/Lab/HSV 六种格式\n4. **点击取色**：在校正后的图片上点击任意位置获取该点颜色\n\n所有色值均可一键复制，方便你在设计软件中使用。',
    },
    {
      keywords: ['转换', '色彩空间', 'rgb', 'hex', 'cmyk', 'hsl'],
      reply:
        '曲泉AI 支持六种色彩空间的实时互转：\n\n- **HEX**：十六进制格式（如 #FF6B35）\n- **RGB**：红绿蓝通道（0-255）\n- **HSL**：色相/饱和度/亮度\n- **HSV**：色相/饱和度/明度\n- **CMYK**：青/品红/黄/黑（印刷用）\n- **Lab**：感知均匀色彩空间\n\n直接在「色彩空间转换」功能中输入任一格式的色值，即可获得全部六种格式的转换结果。',
    },
    {
      keywords: ['手机', 'iPhone', '安卓', 'android'],
      reply:
        '手机拍照校色建议：\n\n1. **自然光优先**：尽量在自然光下拍摄\n2. **锁定曝光/对焦**：长按屏幕锁定 AE/AF\n3. **使用曲泉AI「手机校色」**：专门针对手机传感器特性优化\n4. **开启 HDR**：在手机设置中开启 HDR 模式\n5. **使用 RAW 格式**（若支持）：保留更多后期空间\n\n曲泉AI 的「手机拍摄校色」功能支持 iOS/Android 机型自动识别，还原人眼视觉真实色彩。',
    },
    {
      keywords: ['白平衡', 'wb', '色温', 'kelvin', 'k值'],
      reply:
        '白平衡（WB）设置指南：\n\n| 场景 | 色温(K) | 相机预设 |\n|------|---------|----------|\n| 日光 | 5200-5500 | 晴天/日光 |\n| 阴天 | 6000-6500 | 阴天 |\n| 阴影 | 7000+ | 阴影 |\n| 白炽灯 | 3000-3200 | 钨丝灯 |\n| 荧光灯 | 4000-4500 | 荧光灯 |\n| 闪光灯 | 5400-5600 | 闪光灯 |\n\n不确定时，使用曲泉AI 的「AI 一键校色」功能可以自动识别场景并校正白平衡。',
    },
    {
      keywords: ['对比', '相似度', 'ΔE', 'deltaE'],
      reply:
        '颜色相似度对比：\n\n曲泉AI 使用 CIEDE2000 色差公式（ΔE2000）进行专业色彩对比：\n\n- **ΔE < 1**：人眼几乎无法分辨\n- **ΔE 1-3**：细微差异，专业可见\n- **ΔE 3-5**：明显差异\n- **ΔE > 5**：显著差异\n\n使用方法：选择「颜色相似度对比」功能，上传两张待比较的图片即可获得相似度百分比和 ΔE 值。',
    },
    {
      keywords: ['你好', 'hi', 'hello', '在吗'],
      reply:
        '你好！👋 我是曲泉AI 色彩智能体，可以帮你：\n\n- 🎨 **校正图片颜色**：AI 自动白平衡还原真实色彩\n- 💧 **提取色值**：从图片中获取 HEX/RGB/CMYK 等六色格式\n- 🔄 **色彩转换**：任意色彩空间实时互转\n- ⚖️ **对比色差**：量化两个颜色的 ΔE 相似度\n- 📱 **手机校色**：还原手机照片的人眼真实视觉效果\n\n选择上方功能卡片开始，或直接描述你的色彩问题～',
    },
  ];

  for (const item of knowledgeBase) {
    if (item.keywords.some((k) => text.includes(k.toLowerCase()))) {
      return item.reply;
    }
  }

  return `关于"${userText}"这个问题，我作为色彩智能体的建议是：\n\n这个话题涉及色彩领域的专业知识。如果你能提供更多具体信息（比如使用的设备、拍摄场景、遇到的具体问题等），我可以给出更有针对性的建议。\n\n你也可以尝试使用曲泉AI 的以下功能：\n- 🎨 AI 一键校色：自动校正图片色彩\n- 💧 智能取色：提取图片主色调\n- 🔄 色彩空间转换：多格式互转\n- ⚖️ 颜色对比：量化色差\n\n随时告诉我你需要什么帮助！🌈`;
}

/**
 * 通过后端代理调用 DeepSeek API
 * （API Key 仅存在于服务端环境变量中，不会暴露给前端）
 */
async function callViaProxy(messages: ChatMessage[]): Promise<ChatResponse | null> {
  try {
    const res = await fetch('/api/deepseek/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: COLOR_SYSTEM_PROMPT },
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.choices?.[0]?.message?.content) return null;
    return {
      text: data.choices[0].message.content,
      model: data.model || 'deepseek-chat',
      usage: data.usage,
      fromMock: false,
    };
  } catch {
    return null;
  }
}

/**
 * DeepSeek 对话服务（降级策略：后端代理 → Mock 回复）
 */
export const deepseekService = {
  /**
   * 发送对话请求，自动降级
   * 优先级：后端代理 → Mock 回复
   */
  async chat(userMessage: string, history: ChatMessage[] = []): Promise<ChatResponse> {
    const messages: ChatMessage[] = [...history, { role: 'user', content: userMessage }];

    // 1. 尝试后端代理（生产推荐方式，Key 在服务端）
    const proxyResult = await callViaProxy(messages);
    if (proxyResult) return proxyResult;

    // 2. 降级为本地 Mock（无后端时的开发体验）
    return {
      text: generateMockReply(userMessage),
      model: 'mock-local',
      fromMock: true,
    };
  },

  /**
   * 获取当前连接状态
   */
  getStatus(): { available: boolean; mode: 'proxy' | 'mock' } {
    return {
      available: true,
      mode: 'mock',
    };
  },
};
