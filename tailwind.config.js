/** @type {import('tailwindcss').Config} */

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        brand: {
          // —— 品牌专色 ——
          primary: "#0E4D64", // 曲泉之水：主色 / 实心按钮 / 链接
          primaryLight: "#17708F",
          accent: "#E4572E", // 印刷暖橙：仅作点缀强调
          accentLight: "#F08C63",
          teal: "#2FA8A0",
          cream: "#E9A23B",
          // —— 纸面色谱系统 ——
          paper: "#F4F5F3", // 页面底色（冷调纸白）
          ink: "#24333D", // 墨青主文字
          muted: "#5F6D77", // 次级文字（纸面上 ≥5:1）
          faint: "#7B8892", // 弱化说明 / 占位符 / 装饰标注
          surface: "#FFFFFF", // 卡片 / 抬升面
          line: "#E4E8E6", // 细边框
          lineStrong: "#D2D8D5", // 强调分隔 / 悬停边框
          // —— 旧深色键兼容（页面迁移完成后移除）——
          dark: "#F4F5F3",
          darker: "#FFFFFF",
          card: "#FFFFFF",
          border: "#E4E8E6",
          text: "#24333D",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "-apple-system", "sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          '"Cascadia Code"',
          '"JetBrains Mono"',
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        // 柔和纸感投影（低透明度 + 细轮廓）
        card: "0 1px 2px rgba(23,35,44,0.05), 0 8px 20px -8px rgba(23,35,44,0.10)",
        lift: "0 2px 4px rgba(23,35,44,0.06), 0 16px 32px -12px rgba(23,35,44,0.16)",
        // 旧 glow 键兼容：改为柔和投影（迁移完成后移除）
        glow: "0 1px 2px rgba(23,35,44,0.05), 0 6px 16px -6px rgba(23,35,44,0.10)",
        "glow-accent": "0 6px 16px -6px rgba(228, 87, 46, 0.25)",
      },
      backgroundImage: {
        // CMYK 套色条：印刷四色硬边等分，取代原流动彩虹渐变
        "cmyk-strip":
          "linear-gradient(90deg, #009EE0 0 25%, #E4007E 25% 50%, #FFD200 50% 75%, #1F1F1F 75% 100%)",
        "spectrum-gradient":
          "linear-gradient(90deg, #009EE0 0 25%, #E4007E 25% 50%, #FFD200 50% 75%, #1F1F1F 75% 100%)",
      },
      animation: {
        "fade-in-up": "fadeInUp 0.45s ease-out both",
      },
      keyframes: {
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
