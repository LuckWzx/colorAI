/** 全局短 ID 生成器（8位随机字母数字，前端临时标识用） */
export const uid = (): string => Math.random().toString(36).slice(2, 10);
