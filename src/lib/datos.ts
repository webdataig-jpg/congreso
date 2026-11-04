import datosJson from "../../data/legisladores.json";
import type { Camara, Datos } from "./tipos";

export const datos = datosJson as unknown as Datos;

/** Lo mínimo que necesita la lista de una cámara (evita mandar al navegador los datos de la otra). */
export function datosDeCamara(camara: Camara): Datos {
  return {
    ...datos,
    presupuesto: null,
    avisos: [],
    diputados: camara === "diputados" ? datos.diputados : { ...datos.diputados, lista: [] },
    senadores: camara === "senadores" ? datos.senadores : { ...datos.senadores, lista: [] },
  };
}
