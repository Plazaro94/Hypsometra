import type { Metadata } from "next";
import "@hypsometra/ui/tokens.css";
import "@hypsometra/ui/base.css";
import "./studio.css";

export const metadata: Metadata = {
  title: "Hypsometra",
  description: "Mide el relieve de tu estrategia, no la altura de un pico.",
};

// Applied before paint so a saved light theme does not flash dark on reload.
const themeInit = `try{var t=localStorage.getItem("hypsometra.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
