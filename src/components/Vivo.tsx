"use client";

import { useEffect, useState } from "react";
import { $, $corto, pct } from "@/lib/formato";

export interface MayorGasto {
  nombre: string;
  mensual: number; // pesos por mes en dietas y asesores
  cantidad: number;
  share: number; // sobre el total de dietas y asesores
}

const SEG_POR_MES = (365 * 86400) / 12;

/**
 * Lo que gasta el Congreso mientras la página está abierta, al ritmo de su presupuesto vigente,
 * más la provincia que más suma en dietas y asesores y el gasto por miembro de los bloques más grandes. Tarjeta resaltada en amarillo.
 */
export function GastoEnVivo({
  porSegundo,
  provincia,
  partidos,
}: {
  porSegundo: number;
  provincia: MayorGasto | null;
  partidos: { nombre: string; cantidad: number; mensual: number; porMiembro: number }[];
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
    <section className="flex min-w-0 flex-col rounded-lg border-2 border-vivo-border bg-vivo-bg text-vivo-ink">
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

        {provincia && (
          <dl className="mt-3 border-t border-vivo-rule">
            <Lider etiqueta="Provincia que más gasta" dato={provincia} segundos={segundos} unidad="legisladores" />
          </dl>
        )}

        {partidos.length > 0 && (
          <div className="mt-3">
            <p className="text-[12px] text-vivo-muted">Gasto por partido según cantidad de miembros</p>
            <table className="mt-1 w-full table-fixed text-[13px]">
              <colgroup>
                <col />
                <col className="w-24" />
              </colgroup>
              <thead className="sr-only">
                <tr>
                  <th>Bloque, miembros y gasto mensual</th>
                  <th>Gasto por miembro</th>
                </tr>
              </thead>
              <tbody>
                {partidos.map((p) => (
                  <tr key={p.nombre} className="border-b border-vivo-rule">
                    <td className="py-1.5 pr-2">
                      <span className="block font-bold text-pretty">{p.nombre}</span>
                      <span className="block text-[12px] text-vivo-muted">
                        <span className="num">{p.cantidad}</span> miembros · <span className="num">{$corto(p.mensual)}</span> por mes
                      </span>
                    </td>
                    <td className="py-1.5 text-right align-top whitespace-nowrap">
                      <span className="num block font-bold text-vivo-red">{$corto(p.porMiembro)}</span>
                      <span className="block text-[12px] text-vivo-muted">por miembro</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[12px] leading-4 text-vivo-muted">
          En dietas y asesores, sumando las dos cámaras. Un senador cuesta más que un diputado, así que los bloques con senadores dan
          más por miembro.
        </p>
      </div>
    </section>
  );
}

function Lider({ etiqueta, dato, segundos, unidad }: { etiqueta: string; dato: MayorGasto; segundos: number; unidad: string }) {
  return (
    <div className="border-b border-vivo-rule py-2.5">
      <dt className="text-[12px] text-vivo-muted">{etiqueta}</dt>
      <dd className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate font-bold">{dato.nombre}</span>
        <span className="num shrink-0 font-bold text-vivo-red" aria-hidden>
          {$((segundos * dato.mensual) / SEG_POR_MES)}
        </span>
      </dd>
      <dd className="text-[12px] text-vivo-muted">
        <span className="num">{$corto(dato.mensual)}</span> por mes · {dato.cantidad} {unidad} ·{" "}
        <span className="num">{pct(dato.share, 0)}</span> del total
      </dd>
    </div>
  );
}
