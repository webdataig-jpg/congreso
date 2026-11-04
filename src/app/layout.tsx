import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import datos from "../../data/legisladores.json";
import Shell from "@/components/Shell";
import { fecha } from "@/lib/formato";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: { default: "Cuánto nos cuesta el Congreso", template: "%s · Cuánto nos cuestan" },
  description:
    "Presupuesto del Congreso de la Nación, y para cada diputado y senador: cuánto le queda de mandato, cuántos asesores tiene, cuánto cuesta por mes y en todo el mandato, su contacto y una calificación ciudadana. Datos oficiales.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f4f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-AR" className={geist.variable}>
      <body>
        <Shell actualizado={fecha(datos.generado)}>{children}</Shell>
      </body>
    </html>
  );
}
