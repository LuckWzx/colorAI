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
          primary: "#0E4D64",
          primaryLight: "#1A6B88",
          accent: "#FF6B35",
          accentLight: "#FF8F66",
          teal: "#4ECDC4",
          cream: "#F7C59F",
          dark: "#1A1A2E",
          darker: "#111120",
          card: "rgba(255,255,255,0.04)",
          border: "rgba(255,255,255,0.08)",
          text: "#E8E8F0",
          muted: "#8A8AA0",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', "Georgia", "serif"],
        sans: ['"Noto Sans SC"', "-apple-system", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px rgba(78, 205, 196, 0.15)",
        "glow-accent": "0 0 30px rgba(255, 107, 53, 0.3)",
        card: "0 8px 32px rgba(0,0,0,0.3)",
      },
      backgroundImage: {
        "spectrum-gradient":
          "linear-gradient(135deg, #FF6B35 0%, #F7C59F 33%, #0E4D64 66%, #4ECDC4 100%)",
        "noise-texture":
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",
      },
      animation: {
        "gradient-shift": "gradientShift 8s ease infinite",
        "fade-in-up": "fadeInUp 0.6s ease-out both",
        "float": "float 6s ease-in-out infinite",
        "pulse-slow": "pulse 4s ease-in-out infinite",
      },
      keyframes: {
        gradientShift: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
};
