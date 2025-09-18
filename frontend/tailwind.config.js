/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sunshine: "#F7F170",
        "light-blue": "#049BD0",
        "dark-blue": "#0E1B4D",
        "gray-separator": "#D9D9D9",
        "purple-obc": "#E9B4EB",
        sand: "#F6F3ED",
      },
      fontFamily: {
        whitney: ["Whitney Black", "system-ui", "sans-serif"],
        geograph: ["Geograph", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        tight: "-0.02em",
      },
      animation: {
        marquee: "marquee 60s linear infinite",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
