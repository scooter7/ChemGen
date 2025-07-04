import localFont from "next/font/local";

export const inter = localFont({
  src: [
    {
      path: "./fonts/Inter-VariableFont_opsz,wght.ttf",
      style: "normal",
      weight: "300 400 700",
    },
  ],
  variable: "--font-inter",
  display: "swap",
});

export const schibstedGrotesk = localFont({
  src: [
    {
      path: "./fonts/SchibstedGrotesk-VariableFont_wght.ttf",
      style: "normal",
      weight: "400 700",
    },
  ],
  variable: "--font-schibsted-grotesk",
  display: "swap",
});