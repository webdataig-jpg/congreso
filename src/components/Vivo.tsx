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
 * más la provincia y el bloque que más suman en dietas y asesores. Tarjeta resaltada en amarillo.
 */
export function GastoEnVivo({
  porSegundo,
  provincia,
  bloque,
}: {
  porSegundo: number;
  provincia: MayorGasto | null;
  bloque: MayorGasto | null;
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

        {(provincia || bloque) && (
          <dl className="mt-3 border-t border-vivo-rule">
            {provincia && <Lider etiqueta="Provincia que más gasta" dato={provincia} segundos={segundos} unidad="legisladores" />}
            {bloque && <Lider etiqueta="Bloque que más gasta" dato={bloque} segundos={segundos} unidad="miembros" />}
          </dl>
        )}
        <p className="mt-2 text-[12px] leading-4 text-vivo-muted">En dietas y asesores de sus legisladores, sumando las dos cámaras.</p>
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
