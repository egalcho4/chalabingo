/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        bingo: {
          'b': '#3b82f6',    // Blue
          'i': '#ef4444',    // Red
          'n': '#10b981',    // Green
          'g': '#f59e0b',    // Yellow
          'o': '#8b5cf6',    // Purple
        },
        ethiopia: {
          green: '#078930',
          yellow: '#fcdd09',
          red: '#da121a',
        }
      },
      fontFamily: {
        'amharic': ['Noto Sans Ethiopic', 'Arial', 'sans-serif'],
        'ethiopia': ['Abyssinica SIL', 'Noto Sans Ethiopic', 'serif'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'bounce-slow': 'bounce 3s infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #3b82f6' },
          '50%': { boxShadow: '0 0 20px #3b82f6, 0 0 30px #3b82f6' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      backgroundImage: {
        'bingo-pattern': "url('data:image/svg+xml,%3Csvg width=\"60\" height=\"60\" viewBox=\"0 0 60 60\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Cg fill=\"none\" fill-rule=\"evenodd\"%3E%3Cg fill=\"%233b82f6\" fill-opacity=\"0.1\"%3E%3Cpath d=\"M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')",
        'ethiopian-pattern': "url('data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"100\" height=\"100\" viewBox=\"0 0 100 100\"%3E%3Cpath fill=\"%23078930\" d=\"M0 0h100v33.33H0z\"/%3E%3Cpath fill=\"%23fcdd09\" d=\"M0 33.33h100v33.33H0z\"/%3E%3Cpath fill=\"%23da121a\" d=\"M0 66.67h100V100H0z\"/%3E%3C/svg%3E')",
      },
      boxShadow: {
        'ethiopia': '0 10px 25px rgba(7, 137, 48, 0.3)',
        'bingo-card': '0 8px 32px rgba(59, 130, 246, 0.3)',
      }
    },
  },
  plugins: [],
}