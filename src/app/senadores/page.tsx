import type { Metadata } from "next";
import Lista from "@/components/Lista";
import { datosDeCamara } from "@/lib/datos";

export const metadata: Metadata = {
  title: "Senadores",
  description: "Los 72 senadores nacionales: cuánto les queda de mandato, cuántos asesores tienen, cuánto cuestan, su contacto y una calificación ciudadana.",
};

export default function Senadores() {
  return <Lista datos={datosDeCamara("senadores")} camara="senadores" />;
}
