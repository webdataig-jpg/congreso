import type { Metadata } from "next";
import Lista from "@/components/Lista";
import { datosDeCamara } from "@/lib/datos";

export const metadata: Metadata = {
  title: "Diputados",
  description: "Los 257 diputados nacionales: cuánto les queda de mandato, cuánto cuestan con sus asesores, su contacto y una calificación ciudadana.",
};

export default function Diputados() {
  return <Lista datos={datosDeCamara("diputados")} camara="diputados" />;
}
