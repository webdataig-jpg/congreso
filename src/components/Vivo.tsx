"use client";

import { useEffect, useState } from "react";
import { $ } from "@/lib/formato";

/** Lo que gasta el Congreso mientras la página está abierta, al ritmo de su presupuesto vigente. */
export function GastoEnVivo({ porSegundo }: { porSegundo: number }) {
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
    <div>
      <p className="text-[13px] text-muted">Gastó el Congreso desde que abriste esta página</p>
      <p className="num mt-1 text-[24px] leading-8 font-bold text-hue" aria-hidden>
        {$(segundos * porSegundo)}
      </p>
      <p className="sr-only">El Congreso gasta {$(porSegundo)} por segundo.</p>
      <p className="mt-1 text-[13px] leading-5 text-muted">
        En <span className="num">{m > 0 ? `${m} min ${s} s` : `${s} s`}</span>, a razón de <span className="num text-ink">{$(porSegundo)}</span> por
        segundo según su presupuesto.
      </p>
    </div>
  );
}
