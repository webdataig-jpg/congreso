import datos from "../../data/legisladores.json";
import Tablero from "@/components/Tablero";
import type { Datos } from "@/lib/tipos";

export default function Home() {
  return <Tablero datos={datos as unknown as Datos} />;
}
