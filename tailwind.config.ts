// tailwind.config.ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}', // This line scans your app directory
    // If you had a './pages/**/*.{js,ts,jsx,tsx,mdx}', you'd include it
    // If you had a './components/**/*.{js,ts,jsx,tsx,mdx}', you'd include it
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      // You can add your custom theme extensions here later (colors, fonts, etc.)
    },
  },
  plugins: [],
}
export default config