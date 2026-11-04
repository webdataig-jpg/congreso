"use client";

import { useCallback, useEffect, useState } from "react";
import type { Calificacion, Contacto } from "@/lib/tipos";
import { dec, int } from "@/lib/formato";

const CLAVE_LOCAL = "mis-votos";

function leerMisVotos(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_LOCAL) ?? "{}");
  } catch {
    return {};
  }
}

export interface EstadoCalificaciones {
  disponible: boolean | null; // null = cargando
  resumen: Record<string, Calificacion>;
  misVotos: Record<string, number>;
  votar: (clave: string, puntaje: number) => Promise<string | null>;
}

export function useCalificaciones(): EstadoCalificaciones {
  const [disponible, setDisponible] = useState<boolean | null>(null);
  const [resumen, setResumen] = useState<Record<string, Calificacion>>({});
  const [misVotos, setMisVotos] = useState<Record<string, number>>({});

  useEffect(() => {
    let vivo = true;
    fetch("/api/calificaciones")
      .then((r) => r.json())
      .then((d) => {
        if (!vivo) return;
        setDisponible(Boolean(d.disponible));
        setResumen(d.resumen ?? {});
      })
      .catch(() => vivo && setDisponible(false));
    const t = setTimeout(() => vivo && setMisVotos(leerMisVotos()), 0);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, []);

  const votar = useCallback(async (clave: string, puntaje: number) => {
    const [camara, ...resto] = clave.split(":");
    try {
      const r = await fetch("/api/calificaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camara, id: resto.join(":"), puntaje }),
      });
      const d = await r.json();
      if (!r.ok) return d.error ?? "No se pudo guardar el voto.";
      setResumen((prev) => ({ ...prev, [clave]: d.agregado }));
      setMisVotos((prev) => {
        const nuevo = { ...prev, [clave]: puntaje };
        try {
          localStorage.setItem(CLAVE_LOCAL, JSON.stringify(nuevo));
        } catch {}
        return nuevo;
      });
      return null;
    } catch {
      return "Sin conexión. Probá de nuevo.";
    }
  }, []);

  return { disponible, resumen, misVotos, votar };
}

export const promedio = (c?: Calificacion) => (c && c.cant > 0 ? c.suma / c.cant : null);

function Estrella({ llena, className = "" }: { llena: number; className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <path
        fill="currentColor"
        fillOpacity={llena ? 1 : 0.2}
        d="M10 1.6l2.47 5.3 5.78.62-4.3 3.93 1.2 5.7L10 14.28l-5.15 2.87 1.2-5.7L1.75 7.52l5.78-.62L10 1.6z"
      />
    </svg>
  );
}

/** Resumen compacto para la lista: ★ 3,8 (124) */
export function EstrellasResumen({ c }: { c?: Calificacion }) {
  const p = promedio(c);
  if (p == null || !c) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-tinta-2" title={`${dec(p)} de 5 · ${int(c.cant)} votos`}>
      <Estrella llena={1} className="size-3.5 text-acento" />
      <span className="num">{dec(p)}</span>
      <span className="text-tinta-3">({int(c.cant)})</span>
      <span className="sr-only">
        Calificación promedio {dec(p)} de 5 con {int(c.cant)} votos
      </span>
    </span>
  );
}

export function Calificador({
  clave,
  nombre,
  estado,
}: {
  clave: string;
  nombre: string;
  estado: EstadoCalificaciones;
}) {
  const [hover, setHover] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const mio = estado.misVotos[clave] ?? 0;
  const c = estado.resumen[clave];
  const p = promedio(c);
  const mostrar = hover || mio;

  if (estado.disponible === false) {
    return <p className="text-sm text-tinta-3">Las calificaciones no están disponibles en este momento.</p>;
  }

  const enviar = async (n: number) => {
    if (enviando) return;
    setEnviando(true);
    setMensaje(null);
    const error = await estado.votar(clave, n);
    setEnviando(false);
    setMensaje(error ? { tipo: "error", texto: error } : { tipo: "ok", texto: mio ? "Voto actualizado." : "¡Gracias por votar!" });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div
          role="radiogroup"
          aria-label={`Calificar la gestión de ${nombre}`}
          className="flex"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={mio === n}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              disabled={enviando || estado.disponible === null}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => enviar(n)}
              className="rounded p-0.5 text-acento transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
            >
              <Estrella llena={n <= mostrar ? 1 : 0} className="size-7" />
            </button>
          ))}
        </div>
        <p className="text-sm text-tinta-2">
          {p != null && c ? (
            <>
              <span className="num font-medium text-tinta">{dec(p)}</span> de 5 · {int(c.cant)}{" "}
              {c.cant === 1 ? "voto" : "votos"}
            </>
          ) : (
            "Todavía sin votos"
          )}
        </p>
      </div>
      <p className="mt-1 min-h-5 text-xs" aria-live="polite">
        {mensaje ? (
          <span className={mensaje.tipo === "error" ? "text-acento" : "text-tinta-2"}>{mensaje.texto}</span>
        ) : mio ? (
          <span className="text-tinta-3">Tu voto: {mio} de 5. Podés cambiarlo cuando quieras.</span>
        ) : (
          <span className="text-tinta-3">Anónimo. Un voto por persona, se puede cambiar.</span>
        )}
      </p>
    </div>
  );
}

export function DatosContacto({ c }: { c: Contacto | null }) {
  if (!c) return <p className="text-sm text-tinta-3">Sin datos de contacto publicados.</p>;
  const enlace = "underline decoration-regla underline-offset-2 hover:decoration-acento";
  return (
    <div className="space-y-2 text-sm">
      <dl className="divide-y divide-regla">
        {c.email && (
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-tinta-2">Email</dt>
            <dd className="min-w-0 truncate">
              <a href={`mailto:${c.email}`} className={enlace}>
                {c.email}
              </a>
            </dd>
          </div>
        )}
        {c.telefono && (
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-tinta-2">Teléfono</dt>
            <dd className="num">{c.telefono}</dd>
          </div>
        )}
        {c.oficina && (
          <div className="flex justify-between gap-4 py-1.5">
            <dt className="text-tinta-2">Oficina</dt>
            <dd>{c.oficina}</dd>
          </div>
        )}
      </dl>
      {c.redes.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Redes sociales">
          {c.redes.map((r) => (
            <li key={r.red}>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-block rounded-full border border-regla px-3 py-1 text-xs font-medium hover:border-tinta"
              >
                {r.red}
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <a href={c.perfil} target="_blank" rel="noopener noreferrer" className={enlace}>
          Perfil oficial
        </a>
        {c.despacho && (
          <a href={c.despacho} target="_blank" rel="noopener noreferrer" className={enlace}>
            Teléfono y contacto del despacho
          </a>
        )}
      </p>
    </div>
  );
}
