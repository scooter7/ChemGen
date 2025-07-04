import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class', // Add this line
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        heading: ['var(--font-schibsted-grotesk)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      backgroundColor: {
        'chemgen-dark': '#0B232A',
      },
      textColor: {
        'chemgen-light': '#E6F1F5',
      },
    },
  },
  plugins: [],
};
export default config;