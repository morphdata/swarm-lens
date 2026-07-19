/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0b0e12',
        panel: '#11151b',
        panel2: '#161b22',
        edge: '#232a35',
        edge2: '#303a49',
        txt: '#d7dee8',
        mute: '#8a94a3',
        dim: '#5b6472',
        accent: '#38bdf8',
        ok: '#34d399',
        warn: '#fbbf24',
        err: '#f87171',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
