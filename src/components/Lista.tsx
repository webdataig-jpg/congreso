"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Ajustes, Camara, Datos, Fila } from "@/lib/tipos";
import { construirFilas, fechaMs, finMs, mensual, mesesEntre, progreso, restante, sueldoCategoria } from "@/lib/calculo";
import { $, $corto, dec, fecha, int, plural } from "@/lib/formato";
import { Calificador, DatosContacto, EstrellasResumen, promedio, useCalificaciones, type EstadoCalificaciones } from "./Calificar";
import { Avatar, Canvas, Muestra, Titulo } from "./ui";

type Orden = "vence" | "costo" | "asesores" | "mejor" | "peor" | "apellido";

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function useAjustes(): [Ajustes, (a: Ajustes) => void] {
  const [a, setA] = useState<Ajustes>({ aguinaldo: false, cargasPatronales: 0 });
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const g = JSON.parse(localStorage.getItem("ajustes") ?? "null");
        if (g && typeof g.aguinaldo === "boolean" && typeof g.cargasPatronales === "number") setA(g);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, []);
  const guardar = (n: Ajustes) => {
    setA(n);
    try {
      localStorage.setItem("ajustes", JSON.stringify(n));
    } catch {}
  };
  return [a, guardar];
}

function useAhora(inicial: number) {
  const [ahora, setAhora] = useState(inicial);
  useEffect(() => {
    const t0 = setTimeout(() => setAhora(Date.now()), 0);
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);
  return ahora;
}

export default function Lista({ datos, camara }: { datos: Datos; camara: Camara }) {
  const todas = useMemo(() => construirFilas(datos).filter((f) => f.camara === camara), [datos, camara]);
  const ahora = useAhora(Date.parse(datos.generado));
  const [ajustes, setAjustes] = useAjustes();
  const calif = useCalificaciones();

  const [q, setQ] = useState("");
  const [distrito, setDistrito] = useState("");
  const [bloque, setBloque] = useState("");
  const [orden, setOrden] = useState<Orden>("vence");
  const [abierto, setAbierto] = useState<string | null>(null);
  const qDif = useDeferredValue(q);

  const distritos = useMemo(() => [...new Set(todas.map((f) => f.distrito))].sort((a, b) => a.localeCompare(b, "es")), [todas]);
  const bloques = useMemo(() => [...new Set(todas.map((f) => f.bloque))].sort((a, b) => a.localeCompare(b, "es")), [todas]);

  const visibles = useMemo(() => {
    const nq = normalizar(qDif.trim());
    const nota = (f: Fila, sinVotos: number) => promedio(calif.resumen[`${f.camara}:${f.id}`]) ?? sinVotos;
    const ape = (a: Fila, b: Fila) => a.apellido.localeCompare(b.apellido, "es");
    const cmp: Record<Orden, (a: Fila, b: Fila) => number> = {
      vence: (a, b) => a.fin.localeCompare(b.fin) || ape(a, b),
      costo: (a, b) => mensual(b, ajustes) - mensual(a, ajustes) || ape(a, b),
      asesores: (a, b) => b.asesores - a.asesores || ape(a, b),
      mejor: (a, b) => nota(b, -1) - nota(a, -1) || ape(a, b),
      peor: (a, b) => nota(a, 6) - nota(b, 6) || ape(a, b),
      apellido: ape,
    };
    return todas
      .filter(
        (f) =>
          (!distrito || f.distrito === distrito) &&
          (!bloque || f.bloque === bloque) &&
          (!nq || normalizar(`${f.apellido} ${f.nombre} ${f.distrito} ${f.bloque}`).includes(nq)),
      )
      .sort(cmp[orden]);
  }, [todas, distrito, bloque, qDif, orden, ajustes, calif.resumen]);

  // Cifras de la vista actual: se recalculan con cada filtro
  const totalMes = visibles.reduce((a, f) => a + mensual(f, ajustes), 0);
  const proximoFin = todas.map((f) => f.fin).filter((f) => finMs(f) > ahora).sort()[0];
  const vencenProximo = proximoFin ? todas.filter((f) => f.fin === proximoFin).length : 0;
  const filtrado = visibles.length !== todas.length;
  const nombre = camara === "diputados" ? "diputados" : "senadores";

  return (
    <Canvas>
      <Titulo
        titulo={camara === "diputados" ? "Diputados" : "Senadores"}
        sub={
          <>
            {filtrado ? `${visibles.length} de ${todas.length} ${nombre}` : `${todas.length} ${nombre} en ejercicio`}. Con sus asesores
            cuestan <span className="num text-ink">{$corto(totalMes)}</span> por mes ({$corto(totalMes * 12)} por año).
            {proximoFin && !filtrado && ` ${vencenProximo} terminan su mandato el ${fecha(proximoFin)}.`}
          </>
        }
      />

      {/* Herramientas: buscar, filtrar, ordenar y ajustar el cálculo */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-full sm:basis-60">
          <span className="sr-only">Buscar</span>
          <svg viewBox="0 0 16 16" aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre, provincia o bloque"
            className="h-11 w-full rounded-md border border-control bg-surface pr-3 pl-9 text-[16px] placeholder:text-faint focus:border-ink focus:outline-none sm:h-9 sm:text-[14px]"
          />
        </label>
        <Select etiqueta="Provincia" valor={distrito} onChange={setDistrito} opciones={distritos} todas="Todas las provincias" />
        <Select etiqueta="Bloque" valor={bloque} onChange={setBloque} opciones={bloques} todas="Todos los bloques" />
        <label className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
          <span className="text-[13px] text-muted">Ordenar</span>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            className="h-11 min-w-0 flex-1 rounded-md border border-control bg-surface px-2 text-[16px] sm:h-9 sm:text-[14px]"
          >
            <option value="vence">Vence primero</option>
            <option value="costo">Más caro por mes</option>
            {camara === "senadores" && <option value="asesores">Más asesores</option>}
            <option value="mejor">Mejor calificados</option>
            <option value="peor">Peor calificados</option>
            <option value="apellido">Apellido</option>
          </select>
        </label>
        <AjustesMenu ajustes={ajustes} setAjustes={setAjustes} />
      </div>

      {camara === "diputados" && (
        <p className="mb-3 rounded-md border border-notice-border bg-notice-bg px-4 py-2.5 text-[13px] leading-5 text-notice-ink">
          Diputados no publica cuántos asesores tiene cada despacho. Se reparten en partes iguales los{" "}
          {int(datos.personalDiputados?.total ?? 0)} agentes de planta asignados a bloques, por eso todos muestran ≈
          {dec((datos.personalDiputados?.total ?? 0) / todas.length)}.
        </p>
      )}

      <section aria-label={`Lista de ${nombre}`} className="rounded-lg border border-border bg-surface">
        <div className="hidden h-10 grid-cols-[minmax(0,2.2fr)_minmax(0,1.7fr)_4.5rem_6.5rem_7.5rem_1.25rem] items-center gap-4 border-b border-border px-5 text-[12px] text-muted md:grid">
          <span>{camara === "diputados" ? "Diputado/a" : "Senador/a"}</span>
          <span className="flex items-center gap-3">
            Le queda de mandato
            <span className="hidden lg:inline">
              <Muestra className="bg-hue" /> por cumplir
            </span>
          </span>
          <span className="text-right">Asesores</span>
          <span className="text-right">Por mes</span>
          <span className="text-right">Mandato completo</span>
          <span />
        </div>
        {visibles.length === 0 ? (
          <p className="m-5 rounded-md border border-dashed border-control px-4 py-3 text-[13px] text-muted">
            Ningún {camara === "diputados" ? "diputado" : "senador"} coincide con la búsqueda.
          </p>
        ) : (
          <ul>
            {visibles.map((f) => (
              <FilaLegislador
                key={f.id}
                f={f}
                ahora={ahora}
                ajustes={ajustes}
                datos={datos}
                calif={calif}
                abierto={abierto === f.id}
                alternar={() => setAbierto((a) => (a === f.id ? null : f.id))}
              />
            ))}
          </ul>
        )}
      </section>
    </Canvas>
  );
}

function Select({ etiqueta, valor, onChange, opciones, todas }: { etiqueta: string; valor: string; onChange: (v: string) => void; opciones: string[]; todas: string }) {
  return (
    <label className="min-w-0 flex-1 basis-[calc(50%-4px)] sm:flex-none sm:basis-auto">
      <span className="sr-only">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-md border border-control bg-surface px-2 text-[16px] sm:h-9 sm:w-48 sm:text-[14px]"
      >
        <option value="">{todas}</option>
        {opciones.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function AjustesMenu({ ajustes, setAjustes }: { ajustes: Ajustes; setAjustes: (a: Ajustes) => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const activos = (ajustes.aguinaldo ? 1 : 0) + (ajustes.cargasPatronales > 0 ? 1 : 0);
  useEffect(() => {
    const cerrar = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", cerrar);
    return () => document.removeEventListener("click", cerrar);
  }, []);
  return (
    <details ref={ref} className="relative flex-1 sm:flex-none">
      <summary className="flex h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-md border border-control bg-surface px-3 text-[14px] hover:bg-raised sm:h-9 [&::-webkit-details-marker]:hidden">
        <svg viewBox="0 0 16 16" aria-hidden className="size-4 text-muted" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" />
          <circle cx="10.5" cy="4.5" r="1.5" />
          <circle cx="5.5" cy="11.5" r="1.5" />
        </svg>
        Cálculo{activos > 0 && <span className="num rounded bg-active px-1.5 text-[12px]">{activos}</span>}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(320px,calc(100vw-32px))] rounded-lg border border-border bg-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
        <p className="text-[13px] leading-5 text-muted">
          Por defecto se muestra el bruto mensual de las escalas oficiales. Podés sumar lo que el Estado también paga.
        </p>
        <label className="mt-3 flex items-start gap-3">
          <input type="checkbox" checked={ajustes.aguinaldo} onChange={(e) => setAjustes({ ...ajustes, aguinaldo: e.target.checked })} className="mt-0.5 size-4" />
          <span>
            <span className="block font-medium">Sumar aguinaldo</span>
            <span className="block text-[12px] text-muted">13 sueldos por año en lugar de 12.</span>
          </span>
        </label>
        <label className="mt-3 block">
          <span className="block font-medium">Contribuciones patronales</span>
          <span className="block text-[12px] text-muted">Jubilación, PAMI, obra social y ART sobre el bruto. La tasa no se publica.</span>
          <select
            value={ajustes.cargasPatronales}
            onChange={(e) => setAjustes({ ...ajustes, cargasPatronales: Number(e.target.value) })}
            className="mt-2 h-9 w-full rounded-md border border-control bg-surface px-2"
          >
            {[0, 10, 15, 20, 25, 30].map((v) => (
              <option key={v} value={v}>
                {v === 0 ? "No sumar" : `${v}%`}
              </option>
            ))}
          </select>
        </label>
      </div>
    </details>
  );
}

function textoRestante(fin: string, ahora: number) {
  const r = restante(fin, ahora);
  if (r.totalDias === 0) return "Mandato cumplido";
  const partes: string[] = [];
  if (r.anios) partes.push(plural(r.anios, "año", "años"));
  if (r.meses) partes.push(plural(r.meses, "mes", "meses"));
  if (!r.anios && r.dias) partes.push(plural(r.dias, "día", "días"));
  return partes.join(", ") || "Menos de un día";
}

function FilaLegislador({
  f,
  ahora,
  ajustes,
  datos,
  calif,
  abierto,
  alternar,
}: {
  f: Fila;
  ahora: number;
  ajustes: Ajustes;
  datos: Datos;
  calif: EstadoCalificaciones;
  abierto: boolean;
  alternar: () => void;
}) {
  const m = mensual(f, ajustes);
  const meses = mesesEntre(fechaMs(f.inicio), finMs(f.fin));
  const p = progreso(f, ahora);
  const r = restante(f.fin, ahora);
  const panel = `ficha-${f.id}`;
  const asesores = f.asesoresEstimado ? `≈${dec(f.asesores)}` : int(f.asesores);
  const barra = (
    <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-[2px] bg-raised" role="presentation">
      <span className="h-full" style={{ width: `${p * 100}%` }} />
      <span className="anim-ancho h-full flex-1 bg-hue" />
    </span>
  );

  return (
    <li className="border-t border-rule first:border-t-0">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls={panel}
        className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 text-left transition-colors hover:bg-raised/60 sm:px-5 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.7fr)_4.5rem_6.5rem_7.5rem_1.25rem] ${
          abierto ? "bg-raised/60" : ""
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <Avatar foto={f.foto} nombre={f.nombre} apellido={f.apellido} />
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {f.apellido}, {f.nombre}
            </span>
            <span className="flex min-w-0 items-center gap-2 text-[12px] text-muted">
              <span className="truncate">
                {f.distrito} · {f.bloque}
              </span>
              <EstrellasResumen c={calif.resumen[`${f.camara}:${f.id}`]} />
            </span>
          </span>
        </span>

        <span className="order-3 col-span-2 md:order-none md:col-span-1">
          <span className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className={r.totalDias <= 400 ? "font-medium" : ""}>{textoRestante(f.fin, ahora)}</span>
            <span className="num text-[12px] text-muted">{fecha(f.fin)}</span>
          </span>
          {barra}
          <span className="mt-1.5 flex justify-between text-[12px] text-muted md:hidden">
            <span>{asesores} asesores</span>
            <span>
              Mandato <span className="num text-ink">{$corto(m * meses)}</span>
            </span>
          </span>
        </span>

        <span className="num hidden text-right md:block">{asesores}</span>
        <span className="text-right">
          <span className="num block font-bold">{$corto(m)}</span>
          <span className="block text-[12px] text-muted md:hidden">por mes</span>
        </span>
        <span className="num hidden text-right md:block">
          {$corto(m * meses)}
          <span className="block text-[12px] text-muted">{dec(meses / 12)} años</span>
        </span>
        <svg viewBox="0 0 16 16" aria-hidden className={`hidden size-4 text-muted transition-transform md:block ${abierto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {abierto && <Ficha id={panel} f={f} ahora={ahora} ajustes={ajustes} datos={datos} calif={calif} />}
    </li>
  );
}

function Ficha({ id, f, ahora, ajustes, datos, calif }: { id: string; f: Fila; ahora: number; ajustes: Ajustes; datos: Datos; calif: EstadoCalificaciones }) {
  const inicio = fechaMs(f.inicio);
  const fin = finMs(f.fin);
  const m = mensual(f, ajustes);
  const mesesTotal = mesesEntre(inicio, fin);
  const mesesPasados = mesesEntre(inicio, Math.min(ahora, fin));
  const mesesRestantes = mesesEntre(Math.max(ahora, inicio), fin);
  const base = f.dietaMensual + f.asesoresMensual;
  const cargas = base * (ajustes.cargasPatronales / 100);
  const sac = ajustes.aguinaldo ? (base + cargas) / 12 : 0;
  const cats = f.categorias ? Object.entries(f.categorias).sort((a, b) => Number(a[0]) - Number(b[0])) : [];
  const ya = mesesTotal ? mesesPasados / mesesTotal : 0;

  return (
    <div id={id} className="grid gap-6 border-t border-rule bg-raised/40 px-4 py-5 sm:px-5 lg:grid-cols-3">
      <div>
        <h3 className="mb-1 text-[13px] font-medium">Costo por mes</h3>
        <dl>
          {f.dietaDetalle.map((d) => (
            <Linea key={d.concepto} k={d.concepto} v={$(d.importe)} />
          ))}
          <Linea k={f.asesoresEstimado ? `Asesores (promedio, ${dec(f.asesores)})` : `Asesores (${plural(f.asesores, "agente", "agentes")})`} v={$(f.asesoresMensual)} />
          {ajustes.cargasPatronales > 0 && <Linea k={`Contribuciones (${ajustes.cargasPatronales}%)`} v={$(cargas)} />}
          {ajustes.aguinaldo && <Linea k="Aguinaldo prorrateado" v={$(sac)} />}
          <Linea k="Total por mes" v={$(m)} fuerte />
        </dl>
        {cats.length > 0 && (
          <table className="mt-4 w-full text-left">
            <caption className="mb-1 text-left text-[13px] font-medium">Asesores por categoría</caption>
            <thead className="text-[12px] text-muted">
              <tr>
                <th className="py-1 font-normal">Categoría</th>
                <th className="py-1 text-right font-normal">Cant.</th>
                <th className="py-1 text-right font-normal">Bruto c/u</th>
              </tr>
            </thead>
            <tbody className="num">
              {cats.map(([c, n]) => (
                <tr key={c} className="border-t border-rule">
                  <td className="py-1.5">A-{c}</td>
                  <td className="py-1.5 text-right">{n}</td>
                  <td className="py-1.5 text-right">{$(sueldoCategoria(datos, c))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {f.camara === "senadores" && f.asesores === 0 && <p className="mt-3 text-[12px] text-muted">El Senado no informa personal asignado a este despacho.</p>}
      </div>

      <div>
        <h3 className="mb-1 text-[13px] font-medium">Costo del mandato</h3>
        <p className="text-[12px] text-muted">
          Del {fecha(f.inicio)} al {fecha(f.fin)} · {dec(mesesTotal)} meses
        </p>
        <div className="mt-3 flex h-2 overflow-hidden rounded-[2px]" role="img" aria-label={`Ya pagado ${Math.round(ya * 100)}% del mandato`}>
          <span className="h-full bg-ink" style={{ width: `${ya * 100}%` }} />
          <span className="h-full flex-1 bg-hue" />
        </div>
        <dl className="mt-2">
          <Linea k={<><Muestra className="bg-ink" /> Ya costó</>} v={$(m * mesesPasados)} />
          <Linea k={<><Muestra className="bg-hue" /> Falta pagar</>} v={$(m * mesesRestantes)} />
          <Linea k="Mandato completo" v={$(m * mesesTotal)} fuerte />
        </dl>
        <p className="mt-2 text-[12px] leading-4 text-muted">A valores de hoy, sin proyectar aumentos.</p>
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <h3 className="mb-2 text-[13px] font-medium">Calificá su gestión</h3>
          <Calificador clave={`${f.camara}:${f.id}`} nombre={`${f.nombre} ${f.apellido}`} estado={calif} />
        </div>
        <div>
          <h3 className="mb-1 text-[13px] font-medium">Contacto</h3>
          <DatosContacto c={f.contacto} />
        </div>
      </div>
    </div>
  );
}

function Linea({ k, v, fuerte }: { k: React.ReactNode; v: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 border-t border-rule py-1.5 first:border-t-0 ${fuerte ? "font-bold" : ""}`}>
      <dt className={fuerte ? "font-medium" : "text-muted"}>{k}</dt>
      <dd className="num shrink-0 text-right">{v}</dd>
    </div>
  );
}
