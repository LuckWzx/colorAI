/**
 * 安全工具模块
 * - 数据脱敏：手机号、营业执照、身份证号等 PII 掩码
 * - 输入净化：trim + HTML 实体转义，防 XSS
 * - 数据校验：手机号正则、字段长度限制
 */

/* ============ PII 脱敏 ============ */

/** 手机号脱敏：138****8000 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const p = String(phone).trim();
  if (!/^1\d{10}$/.test(p)) return p;
  return `${p.slice(0, 3)}****${p.slice(7)}`;
}

/** 营业执照/统一社会信用代码脱敏：9144****301 */
export function maskLicense(license: string | null | undefined): string {
  if (!license) return '';
  const v = String(license).trim();
  if (v.length <= 4) return v;
  if (v.length <= 8) return `${v.slice(0, 2)}****${v.slice(-2)}`;
  return `${v.slice(0, 4)}****${v.slice(-4)}`;
}

/** 身份证号脱敏：4405***********12 */
export function maskIdCard(id: string | null | undefined): string {
  if (!id) return '';
  const v = String(id).trim();
  if (v.length < 8) return v;
  return `${v.slice(0, 4)}${'*'.repeat(v.length - 8)}${v.slice(-4)}`;
}

/** 地址脱敏：广东省深圳市南山区*** */
export function maskAddress(address: string | null | undefined): string {
  if (!address) return '';
  const v = String(address).trim();
  if (v.length <= 6) return v;
  return `${v.slice(0, 6)}***`;
}

/** 姓名脱敏：张* / 李** */
export function maskName(name: string | null | undefined): string {
  if (!name) return '';
  const v = String(name).trim();
  if (v.length <= 1) return v;
  if (v.length === 2) return `${v[0]}*`;
  return `${v[0]}${'*'.repeat(v.length - 2)}${v[v.length - 1]}`;
}

/* ============ 输入净化 ============ */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;',
  '`': '&#96;',
  '=': '&#61;',
};

/** HTML 实体转义，防 XSS */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str).replace(/[&<>"'`=\/]/g, (c) => HTML_ENTITIES[c]);
}

/**
 * 输入净化：trim + 移除零宽字符 + HTML 转义
 * 用于所有用户输入字段
 */
export function sanitizeInput(str: string | null | undefined): string {
  if (!str) return '';
  // 移除零宽字符（ZWSP/ZWNJ/ZWJ 等）和控制字符
  const cleaned = String(str)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
  return escapeHtml(cleaned);
}

/**
 * 文本字段净化（不转义 HTML，仅做 trim + 控制字符清理）
 * 适用于仅在后端存储、前端直接展示的场景（已使用 React 自动转义）
 */
export function sanitizeText(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');
}

/** 限制字符串最大长度，超出截断 */
export function truncate(str: string, maxLen: number): string {
  if (!str || str.length <= maxLen) return str;
  return str.slice(0, maxLen);
}

/* ============ 校验 ============ */

/** 手机号校验（中国大陆 11 位） */
export function isValidPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  return /^1[3-9]\d{9}$/.test(String(phone).trim());
}

/** 统一社会信用代码校验（18 位字母数字） */
export function isValidLicense(license: string | null | undefined): boolean {
  if (!license) return true; // 选填字段，空值合法
  return /^[0-9A-Za-z]{15,20}$/.test(String(license).trim());
}

/** 非空字段校验 */
export function isNonEmpty(str: string | null | undefined): boolean {
  return !!String(str ?? '').trim();
}
