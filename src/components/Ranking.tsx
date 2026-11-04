"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { promedio, useCalificaciones } from "./Calificar";
import { Avatar } from "./ui";
import { dec, int } from "@/lib/formato";
import { finMs } from "@/lib/calculo";

export interface Mini {
  camara: "diputados" | "senadores";
  id: string;
  nombre: string;
  apellido: string;
  distrito: string;
  foto: string | null;
}

/** Los mejor calificados por los visitantes (ambas cámaras). */
export function MejorCalificados({ lista }: { lista: Mini[] }) {
  const calif = useCalificaciones();
  const filas = lista
    .map((m) => ({ m, c: calif.resumen[`${m.camara}:${m.id}`] }))
    .filter((x) => x.c && x.c.cant > 0)
    .sort((a, b) => (promedio(b.c) ?? 0) - (promedio(a.c) ?? 0) || b.c.cant - a.c.cant)
    .slice(0, 5);

  if (calif.disponible === null) {
    return (
      <ul aria-busy="true">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex h-12 items-center gap-3 border-t border-rule first:border-t-0">
            <span className="size-8 rounded-full bg-raised" />
            <span className="h-3.5 w-40 rounded bg-raised" />
          </li>
        ))}
      </ul>
    );
  }
  if (calif.disponible === false) {
    return <p className="rounded-md border border-dashed border-control px-4 py-3 text-[13px] text-muted">Las calificaciones no están disponibles en este momento.</p>;
  }
  if (filas.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-control px-4 py-3 text-[13px] text-muted">
        Todavía nadie calificó. Abrí la ficha de un <Link href="/diputados" className="text-ink underline">diputado</Link> o un{" "}
        <Link href="/senadores" className="text-ink underline">senador</Link> y puntuá su gestión.
      </p>
    );
  }
  return (
    <ol>
      {filas.map(({ m, c }, i) => (
        <li key={m.camara + m.id} className="flex h-12 items-center gap-3 border-t border-rule first:border-t-0">
          <span className="num w-4 text-[12px] text-muted">{i + 1}.</span>
          <Avatar foto={m.foto} nombre={m.nombre} apellido={m.apellido} />
          <span className="min-w-0 flex-1">
            <span className="block truncate">
              {m.apellido}, {m.nombre}
            </span>
            <span className="block truncate text-[12px] text-muted">
              {m.camara === "diputados" ? "Diputado/a" : "Senador/a"} · {m.distrito}
            </span>
          </span>
          <span className="num text-right">
            <span className="font-medium">{dec(promedio(c) ?? 0)}</span>
            <span className="text-muted"> / 5</span>
            <span className="block text-[12px] text-muted">{int(c.cant)} {c.cant === 1 ? "voto" : "votos"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Días que faltan hasta el fin de un mandato, calculados en el navegador. */
export function DiasHasta({ fin, desde }: { fin: string; desde: number }) {
  const [ahora, setAhora] = useState(desde);
  useEffect(() => {
    const t = setTimeout(() => setAhora(Date.now()), 0);
    return () => clearTimeout(t);
  }, []);
  const dias = Math.max(0, Math.ceil((finMs(fin) - ahora) / 86_400_000));
  return <span className="num">{int(dias)}</span>;
}
