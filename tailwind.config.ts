const config = {
  darkMode: ["class"],
  content: [
    "./layouts/**/*.{njk,html}",
    "./templates/**/*.{njk,html}",
    "./widgets/**/*.{njk,html}",
    "./ui/**/*.{njk,html}",
    "./pages/**/*.{njk,html}",
    "./assets/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        successGreenLight: "#ECFDF3",
        successGreen: "#ECFDF3",
        error: "#ECFDF3",
        errorLight: "#FEF3F2",
        stork: "#E2E2E2",
        bgItem: "#F7F7F7",
        textDescription: "#666666",
      },
    },
  },
};
export default config;
