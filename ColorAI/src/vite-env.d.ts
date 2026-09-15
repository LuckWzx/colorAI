/// <reference types="vite/client" />

// 声明合并用的扩展点：保持为空接口，供后续添加自定义 VITE_* 变量类型
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ImportMetaEnv {
  // Vite 环境变量声明（如有需要请在此添加）
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
