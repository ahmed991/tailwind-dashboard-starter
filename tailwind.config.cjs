module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sidebar: "#2f2b2f",              // dark sidebar
        accent1: "#cddc39",              // lime
        accent2: "#00bcd4",              // cyan
        accent3: "#e91e63",              // pink
        accent4: "#ffeb3b",              // yellow
        panelBg: "rgba(255, 255, 255, 0.85)",
        textPrimary: "#ffffff",
      },
      fontFamily: {
        body: ["'Heebo'", "sans-serif"], // or swap for 'Hero' if you include it
      },
    },
  },
  plugins: [],
};
