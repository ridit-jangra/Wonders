import {
  Atkinson_Hyperlegible,
  Fira_Code,
  Geist_Mono,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Source_Code_Pro,
} from "next/font/google";

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: "variable", variable: "--font-plex-sans", preload: false });
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
  preload: false,
});
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", preload: false });
const firaCode = Fira_Code({ subsets: ["latin"], variable: "--font-fira-code", preload: false });
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-plex-mono",
  preload: false,
});
const sourceCodePro = Source_Code_Pro({ subsets: ["latin"], variable: "--font-source-code-pro", preload: false });

export const adminFontVariables = [plexSans, atkinson, geistMono, firaCode, plexMono, sourceCodePro]
  .map((f) => f.variable)
  .join(" ");
