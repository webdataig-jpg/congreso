"use client";

import { useEffect, useState } from "react";
import { $, $corto } from "@/lib/formato";

export interface GastoGrupo {
  nombre: string;
  cantidad: number;
  mensual: number; // pesos por mes en dietas y asesores
  porMiembro: number;
}

/**
 * Lo que gasta el Congreso mientras la página está abierta, al ritmo de su presupuesto vigente,
 * más el gasto por legislador de las provincias y los bloques más grandes. Tarjeta resaltada en amarillo.
 */
export function GastoEnVivo({
  porSegundo,
  provincias,
  partidos,
}: {
  porSegundo: number;
  provincias: GastoGrupo[];
  partidos: GastoGrupo[];
}) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const inicio = performance.now();
    const lento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setInterval(() => setSegundos((performance.now() - inicio) / 1000), lento ? 1000 : 100);
    return () => clearInterval(t);
  }, []);

  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);

  return (
    <section className="flex min-w-0 flex-col rounded-lg border-2 border-vivo-border bg-vivo-bg text-vivo-ink shadow-tarjeta">
      <header className="flex items-baseline justify-between gap-4 px-5 pt-4 pb-2">
        <h2 className="flex items-center gap-2 text-[16px] leading-6 font-bold">
          <span className="relative flex size-2.5" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-vivo-red opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-vivo-red" />
          </span>
          En vivo
        </h2>
      </header>
      <div className="px-5 pb-4">
        <p className="text-[13px] text-vivo-muted">Gastó el Congreso desde que abriste esta página</p>
        <p className="num mt-1 text-[30px] leading-9 font-bold text-vivo-red" aria-hidden>
          {$(segundos * porSegundo)}
        </p>
        <p className="sr-only">El Congreso gasta {$(porSegundo)} por segundo.</p>
        <p className="mt-1 text-[13px] leading-5 text-vivo-muted">
          En <span className="num">{m > 0 ? `${m} min ${s} s` : `${s} s`}</span>, a razón de{" "}
          <span className="num font-medium text-vivo-ink">{$(porSegundo)}</span> por segundo según su presupuesto.
        </p>

        <TablaGrupos titulo="Gasto por provincia según cantidad de legisladores" grupos={provincias} unidad="legisladores" encabezado="Provincia" />
        <TablaGrupos titulo="Gasto por partido según cantidad de miembros" grupos={partidos} unidad="miembros" encabezado="Bloque" />

        <p className="mt-2 text-[12px] leading-4 text-vivo-muted">
          En dietas y asesores, sumando las dos cámaras. Un senador cuesta más que un diputado, así que donde pesan los senadores el gasto
          por miembro es mayor.
        </p>
      </div>
    </section>
  );
}

function TablaGrupos({ titulo, grupos, unidad, encabezado }: { titulo: string; grupos: GastoGrupo[]; unidad: string; encabezado: string }) {
  if (grupos.length === 0) return null;
  return (
    <div className="mt-3 border-t border-vivo-rule pt-2.5">
      <p className="text-[12px] text-vivo-muted">{titulo}</p>
      <table className="mt-1 w-full table-fixed text-[13px]">
        <colgroup>
          <col />
          <col className="w-24" />
        </colgroup>
        <thead className="sr-only">
          <tr>
            <th>{encabezado}, {unidad} y gasto mensual</th>
            <th>Gasto por {unidad === "legisladores" ? "legislador" : "miembro"}</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((g) => (
            <tr key={g.nombre} className="border-b border-vivo-rule last:border-b-0">
              <td className="py-1.5 pr-2">
                <span className="block font-bold text-pretty">{g.nombre}</span>
                <span className="block text-[12px] text-vivo-muted">
                  <span className="num">{g.cantidad}</span> {unidad} · <span className="num">{$corto(g.mensual)}</span> por mes
                </span>
              </td>
              <td className="py-1.5 text-right align-top whitespace-nowrap">
                <span className="num block font-bold text-vivo-red">{$corto(g.porMiembro)}</span>
                <span className="block text-[12px] text-vivo-muted">por {unidad === "legisladores" ? "legislador" : "miembro"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
