import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    './app/(app)/vault/**/*.{js,ts,jsx,tsx,mdx}',
    './app/(app)/vault/page.tsx'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
