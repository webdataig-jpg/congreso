"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Ajustes, Camara, Datos, Fila } from "@/lib/tipos";
import { construirFilas, fechaMs, finMs, mensual, mesesEntre, progreso, restante, sueldoCategoria } from "@/lib/calculo";
import { $, $corto, dec, fecha, int, plural } from "@/lib/formato";

type Orden = "vence" | "costo" | "asesores" | "apellido";

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Tablero({ datos }: { datos: Datos }) {
  const filas = useMemo(() => construirFilas(datos), [datos]);

  // Arranca con la fecha de generación (igual en servidor y cliente) y pasa a "ahora" al montar.
  const [ahora, setAhora] = useState(() => Date.parse(datos.generado));
  useEffect(() => {
    const t0 = setTimeout(() => setAhora(Date.now()), 0);
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => {
      clearTimeout(t0);
      clearInterval(t);
    };
  }, []);

  const [camara, setCamara] = useState<Camara>("diputados");
  const [q, setQ] = useState("");
  const [distrito, setDistrito] = useState("");
  const [bloque, setBloque] = useState("");
  const [orden, setOrden] = useState<Orden>("vence");
  const [ajustes, setAjustes] = useState<Ajustes>({ aguinaldo: false, cargasPatronales: 0 });
  const [abierto, setAbierto] = useState<string | null>(null);
  const qDiferida = useDeferredValue(q);

  const deCamara = useMemo(() => filas.filter((f) => f.camara === camara), [filas, camara]);
  const distritos = useMemo(() => [...new Set(deCamara.map((f) => f.distrito))].sort((a, b) => a.localeCompare(b, "es")), [deCamara]);
  const bloques = useMemo(() => [...new Set(deCamara.map((f) => f.bloque))].sort((a, b) => a.localeCompare(b, "es")), [deCamara]);

  const visibles = useMemo(() => {
    const nq = normalizar(qDiferida.trim());
    const r = deCamara.filter(
      (f) =>
        (!distrito || f.distrito === distrito) &&
        (!bloque || f.bloque === bloque) &&
        (!nq || normalizar(`${f.apellido} ${f.nombre} ${f.distrito} ${f.bloque}`).includes(nq)),
    );
    const cmp: Record<Orden, (a: Fila, b: Fila) => number> = {
      vence: (a, b) => a.fin.localeCompare(b.fin) || a.apellido.localeCompare(b.apellido, "es"),
      costo: (a, b) => mensual(b, ajustes) - mensual(a, ajustes) || a.apellido.localeCompare(b.apellido, "es"),
      asesores: (a, b) => b.asesores - a.asesores || a.apellido.localeCompare(b.apellido, "es"),
      apellido: (a, b) => a.apellido.localeCompare(b.apellido, "es"),
    };
    return r.sort(cmp[orden]);
  }, [deCamara, distrito, bloque, qDiferida, orden, ajustes]);

  const resumen = useMemo(() => {
    const porCamara = (c: Camara) => {
      const fs = filas.filter((f) => f.camara === c);
      return {
        n: fs.length,
        mensual: fs.reduce((a, f) => a + mensual(f, ajustes), 0),
        asesores: fs.reduce((a, f) => a + f.asesores, 0),
      };
    };
    const dip = porCamara("diputados");
    const sen = porCamara("senadores");
    const proximo = filas.map((f) => f.fin).filter((f) => finMs(f) > ahora).sort()[0];
    const vencen = proximo ? filas.filter((f) => f.fin === proximo) : [];
    return {
      dip,
      sen,
      total: dip.mensual + sen.mensual,
      proximo,
      vencenDip: vencen.filter((f) => f.camara === "diputados").length,
      vencenSen: vencen.filter((f) => f.camara === "senadores").length,
    };
  }, [filas, ajustes, ahora]);

  const cambiarCamara = (c: Camara) => {
    setCamara(c);
    setDistrito("");
    setBloque("");
    setAbierto(null);
    if (c === "diputados" && orden === "asesores") setOrden("vence");
  };

  const rProx = resumen.proximo ? restante(resumen.proximo, ahora) : null;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* Cabecera */}
      <header className="border-b-2 border-tinta pt-8 pb-6 sm:pt-12">
        <p className="text-xs font-medium tracking-[0.18em] text-tinta-2 uppercase">
          Congreso de la Nación Argentina · datos oficiales
        </p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] sm:text-7xl">¿Cuánto nos cuestan?</h1>
        <p className="mt-4 max-w-2xl text-base text-tinta-2 sm:text-lg">
          Cuánto le queda de mandato a cada diputado y senador, cuántos asesores tiene y cuánto cuesta
          mantenerlo por mes y en todo su mandato, con dieta y asesores incluidos.
        </p>
      </header>

      {/* Resumen */}
      <section aria-label="Resumen" className="grid grid-cols-2 border-b border-regla lg:grid-cols-4">
        <Dato
          etiqueta="Legisladores + asesores, por mes"
          valor={$corto(resumen.total)}
          nota={`${$corto(resumen.total * 12)} por año`}
          destacado
        />
        <Dato
          etiqueta={`${resumen.dip.n} diputados`}
          valor={$corto(resumen.dip.mensual)}
          nota={`≈ ${int(resumen.dip.asesores)} agentes de bloque`}
        />
        <Dato
          etiqueta={`${resumen.sen.n} senadores`}
          valor={$corto(resumen.sen.mensual)}
          nota={`${int(resumen.sen.asesores)} asesores declarados`}
        />
        <Dato
          etiqueta="Próximo recambio"
          valor={rProx ? `${int(rProx.totalDias)} días` : "—"}
          nota={
            resumen.proximo
              ? `${fecha(resumen.proximo)}: ${resumen.vencenDip} diputados y ${resumen.vencenSen} senadores`
              : ""
          }
        />
      </section>

      {/* Controles */}
      <section aria-label="Filtros" className="sticky top-0 z-10 -mx-4 border-b border-regla bg-papel/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Cámara" className="flex rounded-full border border-tinta p-0.5">
            {(["diputados", "senadores"] as Camara[]).map((c) => (
              <button
                key={c}
                role="tab"
                aria-selected={camara === c}
                onClick={() => cambiarCamara(c)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                  camara === c ? "bg-tinta text-papel" : "text-tinta hover:bg-papel-2"
                }`}
              >
                {c} <span className="num opacity-70">{c === "diputados" ? resumen.dip.n : resumen.sen.n}</span>
              </button>
            ))}
          </div>
          <label className="relative min-w-0 flex-1 basis-48">
            <span className="sr-only">Buscar</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, provincia o bloque"
              className="w-full rounded-full border border-regla bg-papel px-4 py-2 text-base placeholder:text-tinta-3 focus:border-tinta focus:outline-none sm:text-sm"
            />
          </label>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Selector etiqueta="Provincia" valor={distrito} onChange={setDistrito} opciones={distritos} todas="Todas las provincias" />
          <Selector etiqueta="Bloque" valor={bloque} onChange={setBloque} opciones={bloques} todas="Todos los bloques" />
          <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-1 sm:ml-auto">
            <span className="text-tinta-2">Ordenar</span>
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
              className="min-w-0 flex-1 rounded-md border border-regla bg-papel px-2 py-1.5 text-base sm:text-sm"
            >
              <option value="vence">Vence primero</option>
              <option value="costo">Más caro por mes</option>
              {camara === "senadores" && <option value="asesores">Más asesores</option>}
              <option value="apellido">Apellido</option>
            </select>
          </label>
        </div>
      </section>

      {camara === "diputados" && (
        <p className="mt-4 rounded-md border-l-4 border-acento bg-acento-suave px-4 py-3 text-sm leading-relaxed">
          <strong>Asesores de diputados: promedio estimado.</strong> La Cámara de Diputados no publica cuántos
          asesores tiene cada despacho. Se toma el personal de planta afectado a bloques políticos (
          {int(datos.personalDiputados?.total ?? 0)} agentes) y se reparte en partes iguales entre los{" "}
          {resumen.dip.n} diputados. Por eso todos muestran el mismo número.
        </p>
      )}

      {/* Lista */}
      <section aria-label="Legisladores" className="mt-4">
        <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_5.5rem_minmax(0,1fr)_minmax(0,1.1fr)] gap-4 border-b border-tinta pb-2 text-xs font-medium tracking-wide text-tinta-2 uppercase md:grid">
          <span>Legislador</span>
          <span>Le queda de mandato</span>
          <span className="text-right">Asesores</span>
          <span className="text-right">Por mes</span>
          <span className="text-right">Mandato completo</span>
        </div>
        <p className="py-3 text-sm text-tinta-2" aria-live="polite">
          {plural(visibles.length, "resultado", "resultados")}
        </p>
        <ul className="divide-y divide-regla border-y border-regla">
          {visibles.map((f) => (
            <FilaLegislador
              key={f.camara + f.id}
              f={f}
              ahora={ahora}
              ajustes={ajustes}
              datos={datos}
              abierto={abierto === f.camara + f.id}
              alternar={() => setAbierto((a) => (a === f.camara + f.id ? null : f.camara + f.id))}
            />
          ))}
        </ul>
        {visibles.length === 0 && (
          <p className="py-12 text-center text-tinta-2">No hay legisladores que coincidan con la búsqueda.</p>
        )}
      </section>

      <Ajustes ajustes={ajustes} setAjustes={setAjustes} />
      <Metodologia datos={datos} />
    </main>
  );
}

function Dato({ etiqueta, valor, nota, destacado }: { etiqueta: string; valor: string; nota: string; destacado?: boolean }) {
  return (
    <div className="border-regla py-5 pr-4 [&:nth-child(odd)]:border-r lg:border-r lg:pl-4 lg:first:pl-0 lg:last:border-r-0 [&:nth-child(even)]:pl-4">
      <p className="text-xs text-tinta-2">{etiqueta}</p>
      <p className={`num mt-1 text-2xl font-medium sm:text-3xl ${destacado ? "text-acento" : ""}`}>{valor}</p>
      <p className="mt-1 text-xs text-tinta-3">{nota}</p>
    </div>
  );
}

function Selector({
  etiqueta,
  valor,
  onChange,
  opciones,
  todas,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  opciones: string[];
  todas: string;
}) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-regla bg-papel px-2 py-1.5 text-base sm:w-56 sm:text-sm"
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

function textoRestante(fin: string, ahora: number) {
  const r = restante(fin, ahora);
  if (r.totalDias === 0) return "Mandato cumplido";
  const partes = [];
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
  abierto,
  alternar,
}: {
  f: Fila;
  ahora: number;
  ajustes: Ajustes;
  datos: Datos;
  abierto: boolean;
  alternar: () => void;
}) {
  const m = mensual(f, ajustes);
  const mesesTotal = mesesEntre(fechaMs(f.inicio), finMs(f.fin));
  const r = restante(f.fin, ahora);
  const p = progreso(f, ahora);
  const iniciales = (f.apellido[0] ?? "") + (f.nombre[0] ?? "");
  const panel = `panel-${f.camara}-${f.id}`;

  return (
    <li>
      <button
        onClick={alternar}
        aria-expanded={abierto}
        aria-controls={panel}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-4 text-left hover:bg-papel-2/60 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_5.5rem_minmax(0,1fr)_minmax(0,1.1fr)] md:gap-4"
      >
        <span className="flex min-w-0 items-center gap-3">
          {f.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.foto} alt="" width={40} height={40} loading="lazy" className="size-10 shrink-0 rounded-full bg-papel-2 object-cover grayscale" />
          ) : (
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-papel-2 text-xs font-medium text-tinta-2">
              {iniciales}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate font-medium">
              {f.apellido}, {f.nombre}
            </span>
            <span className="block truncate text-xs text-tinta-2">
              {f.distrito} · {f.bloque}
            </span>
          </span>
        </span>

        <span className="order-3 col-span-2 md:order-none md:col-span-1">
          <span className="flex items-baseline justify-between gap-2 text-sm">
            <span className={r.totalDias <= 400 ? "font-medium text-acento" : ""}>{textoRestante(f.fin, ahora)}</span>
            <span className="num text-xs text-tinta-3">{fecha(f.fin)}</span>
          </span>
          <span className="barra mt-1.5 block h-1.5 overflow-hidden rounded-full bg-papel-2" role="presentation">
            <span className="block h-full rounded-full bg-tinta" style={{ width: `${p * 100}%` }} />
          </span>
          <span className="mt-1.5 flex justify-between text-xs text-tinta-2 md:hidden">
            <span>Mandato completo ({dec(mesesTotal / 12)} años)</span>
            <span className="num">{$corto(m * mesesTotal)}</span>
          </span>
        </span>

        <span className="hidden text-right md:block">
          <span className="num">{f.asesoresEstimado ? `≈${dec(f.asesores)}` : int(f.asesores)}</span>
        </span>

        <span className="text-right">
          <span className="num block font-medium">{$corto(m)}</span>
          <span className="block text-xs text-tinta-3 md:hidden">
            por mes · {f.asesoresEstimado ? `≈${dec(f.asesores)}` : int(f.asesores)} asesores
          </span>
        </span>

        <span className="hidden text-right md:block">
          <span className="num block">{$corto(m * mesesTotal)}</span>
          <span className="block text-xs text-tinta-3">{dec(mesesTotal / 12)} años</span>
        </span>
      </button>

      {abierto && <Detalle id={panel} f={f} ahora={ahora} ajustes={ajustes} datos={datos} />}
    </li>
  );
}

function Detalle({ id, f, ahora, ajustes, datos }: { id: string; f: Fila; ahora: number; ajustes: Ajustes; datos: Datos }) {
  const inicio = fechaMs(f.inicio);
  const fin = finMs(f.fin);
  const m = mensual(f, ajustes);
  const mesesTotal = mesesEntre(inicio, fin);
  const mesesPasados = mesesEntre(inicio, Math.min(ahora, fin));
  const mesesRestantes = mesesEntre(Math.max(ahora, inicio), fin);
  const baseMensual = f.dietaMensual + f.asesoresMensual;
  const cargas = baseMensual * (ajustes.cargasPatronales / 100);
  const sac = ajustes.aguinaldo ? (baseMensual + cargas) / 12 : 0;
  const cats = f.categorias
    ? Object.entries(f.categorias).sort((a, b) => Number(a[0]) - Number(b[0]))
    : [];

  return (
    <div id={id} className="grid gap-6 bg-papel-2/50 px-4 py-5 text-sm sm:px-6 md:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-tinta-2 uppercase">Costo mensual</h3>
        <dl className="divide-y divide-regla">
          {f.dietaDetalle.map((d) => (
            <Linea key={d.concepto} k={d.concepto} v={$(d.importe)} />
          ))}
          <Linea
            k={
              f.asesoresEstimado
                ? `Asesores (promedio: ${dec(f.asesores)} agentes de bloque)`
                : `Asesores (${plural(f.asesores, "agente", "agentes")})`
            }
            v={$(f.asesoresMensual)}
          />
          {ajustes.cargasPatronales > 0 && <Linea k={`Contribuciones patronales (${ajustes.cargasPatronales}%)`} v={$(cargas)} />}
          {ajustes.aguinaldo && <Linea k="Aguinaldo prorrateado (1/12)" v={$(sac)} />}
          <Linea k="Total por mes" v={$(m)} fuerte />
        </dl>

        {cats.length > 0 && (
          <>
            <h3 className="mt-5 mb-2 text-xs font-medium tracking-wide text-tinta-2 uppercase">Asesores por categoría</h3>
            <table className="w-full text-left">
              <thead className="text-xs text-tinta-3">
                <tr>
                  <th className="py-1 font-normal">Categoría</th>
                  <th className="py-1 text-right font-normal">Cant.</th>
                  <th className="py-1 text-right font-normal">Sueldo bruto c/u</th>
                </tr>
              </thead>
              <tbody className="num">
                {cats.map(([c, n]) => (
                  <tr key={c} className="border-t border-regla">
                    <td className="py-1">A-{c}</td>
                    <td className="py-1 text-right">{n}</td>
                    <td className="py-1 text-right">{$(sueldoCategoria(datos, c))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {f.camara === "senadores" && f.asesores === 0 && (
          <p className="mt-3 text-xs text-tinta-2">El Senado no informa personal asignado a este despacho.</p>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-xs font-medium tracking-wide text-tinta-2 uppercase">Mandato</h3>
        <dl className="divide-y divide-regla">
          <Linea k="Asumió" v={fecha(f.inicio)} />
          <Linea k="Termina" v={fecha(f.fin)} />
          <Linea k="Duración" v={`${dec(mesesTotal)} meses`} />
          <Linea k="Le quedan" v={`${int(restante(f.fin, ahora).totalDias)} días`} />
        </dl>
        <h3 className="mt-5 mb-2 text-xs font-medium tracking-wide text-tinta-2 uppercase">Costo del mandato</h3>
        <dl className="divide-y divide-regla">
          <Linea k={`Ya costó (${dec(mesesPasados)} meses)`} v={$(m * mesesPasados)} />
          <Linea k={`Falta pagar (${dec(mesesRestantes)} meses)`} v={$(m * mesesRestantes)} />
          <Linea k="Mandato completo" v={$(m * mesesTotal)} fuerte />
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-tinta-3">
          A valores de hoy, sin proyectar aumentos futuros.
        </p>
      </div>
    </div>
  );
}

function Linea({ k, v, fuerte }: { k: string; v: string; fuerte?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1.5 ${fuerte ? "font-medium" : ""}`}>
      <dt className={fuerte ? "" : "text-tinta-2"}>{k}</dt>
      <dd className="num shrink-0 text-right">{v}</dd>
    </div>
  );
}

function Ajustes({ ajustes, setAjustes }: { ajustes: Ajustes; setAjustes: (a: Ajustes) => void }) {
  return (
    <section aria-labelledby="t-ajustes" className="mt-14 border-t-2 border-tinta pt-6">
      <h2 id="t-ajustes" className="font-display text-3xl sm:text-4xl">Ajustar el cálculo</h2>
      <p className="mt-2 max-w-2xl text-sm text-tinta-2">
        Por defecto se muestra el costo bruto mensual: lo que figura en las escalas oficiales. Podés sumar
        conceptos que también paga el Estado pero que no se publican por legislador.
      </p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-regla p-4">
          <input
            type="checkbox"
            checked={ajustes.aguinaldo}
            onChange={(e) => setAjustes({ ...ajustes, aguinaldo: e.target.checked })}
            className="mt-1 size-4"
          />
          <span>
            <span className="block font-medium">Sumar aguinaldo</span>
            <span className="block text-sm text-tinta-2">
              Agrega un sueldo más por año (13 en lugar de 12), prorrateado por mes.
            </span>
          </span>
        </label>
        <div className="rounded-lg border border-regla p-4">
          <label htmlFor="cargas" className="flex items-baseline justify-between font-medium">
            Contribuciones patronales <span className="num">{ajustes.cargasPatronales}%</span>
          </label>
          <input
            id="cargas"
            type="range"
            min={0}
            max={40}
            step={1}
            value={ajustes.cargasPatronales}
            onChange={(e) => setAjustes({ ...ajustes, cargasPatronales: Number(e.target.value) })}
            className="mt-3 w-full"
          />
          <span className="block text-sm text-tinta-2">
            Aportes que paga el Congreso como empleador (jubilación, PAMI, obra social, ART) encima del bruto.
            La tasa exacta no se publica: elegí la que quieras suponer.
          </span>
        </div>
      </div>
    </section>
  );
}

function Enlace({ href, children }: { href: string | null; children: React.ReactNode }) {
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-regla underline-offset-2 hover:decoration-acento">
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

function Metodologia({ datos }: { datos: Datos }) {
  const p = datos.parametros;
  const act = (s: string | null) => (s ? ` (actualizado ${fecha(s)})` : "");

  return (
    <section aria-labelledby="t-metodo" className="mt-14 border-t-2 border-tinta pt-6 text-sm leading-relaxed">
      <h2 id="t-metodo" className="font-display text-3xl sm:text-4xl">Cómo se calcula</h2>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="space-y-3 text-tinta-2">
          <p>
            <strong className="text-tinta">Mandato.</strong> Los diputados duran 4 años y los senadores 6. Todos
            terminan el 9 de diciembre del último año. El tiempo restante se cuenta en hora argentina hasta ese día
            inclusive. Si alguien asumió como reemplazo, el mandato se cuenta desde que asumió.
          </p>
          <p>
            <strong className="text-tinta">Dieta de diputados.</strong> Dieta más gastos de representación según la
            planilla de remuneraciones de HCDN: {$(datos.dietaDiputado.dieta)} + {$(datos.dietaDiputado.gastosRepresentacion)}.
            No se suman desarraigo ni movilidad porque dependen de cada diputado y HCDN no informa quién los cobra.
          </p>
          <p>
            <strong className="text-tinta">Dieta de senadores.</strong> {int(p.modulosDietaSenador)} módulos:{" "}
            {p.modulosDietaSenadorDetalle}. Algunos senadores renunciaron a aumentos y pueden cobrar menos.
          </p>
          <p>
            <strong className="text-tinta">Sueldo de cada asesor.</strong> Módulos de su categoría en la escala de la
            Ley 24.600 (dedicación funcional + sueldo básico) más el suplemento de {dec(p.modulosRC)} módulos,
            multiplicado por el valor del módulo ({p.valorModulo.toLocaleString("es-AR")} desde{" "}
            {p.valorModuloVigencia}). No se suman antigüedad, títulos, presentismo ni capacitación porque varían
            por persona, así que el costo real es mayor.
          </p>
          <p>
            <strong className="text-tinta">Asesores de senadores.</strong> Personal que el Senado declara en la
            página de cada senador, con su categoría. Los contratos de locación de servicios no figuran ahí.
          </p>
          <p>
            <strong className="text-tinta">Asesores de diputados.</strong> HCDN no publica el personal por
            despacho. Se usa el personal de planta «afectado a bloque político» de la nómina oficial, repartido en
            partes iguales entre los diputados. No incluye contratados.
          </p>
          <p>
            <strong className="text-tinta">Lo que no incluye.</strong> Pasajes, viáticos, gastos de funcionamiento
            del despacho, personal de comisiones y de la administración de cada Cámara.
          </p>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-medium tracking-wide text-tinta-2 uppercase">Fuentes</h3>
          <ul className="space-y-2">
            <li>
              <Enlace href={datos.diputados.url}>HCDN · Composición actual de la Cámara</Enlace>
              {act(datos.diputados.actualizado)}
            </li>
            <li>
              <Enlace href={datos.dietaDiputado.url}>HCDN · Remuneraciones de diputados</Enlace>
              {act(datos.dietaDiputado.actualizado)}
            </li>
            <li>
              <Enlace href={datos.personalDiputados?.url ?? null}>HCDN · Nómina de personal</Enlace>
              {act(datos.personalDiputados?.actualizado ?? null)}
            </li>
            <li>
              <Enlace href={datos.escala.url}>HCDN · Escala salarial (módulos)</Enlace>
              {act(datos.escala.actualizado)}
            </li>
            <li>
              <Enlace href={datos.senadores.url}>Senado · Listado de senadores (datos abiertos)</Enlace> y personal
              publicado en la página de cada senador
              {act(datos.senadores.actualizado)}
            </li>
            <li>
              <Enlace href={p.modulosDietaSenadorFuente}>Senado · Dietas y gastos de representación</Enlace>
            </li>
            <li>
              <Enlace href={p.valorModuloFuente}>Senado · Escala salarial y valor del módulo</Enlace>
            </li>
          </ul>
          <p className="mt-6 text-xs text-tinta-3">
            Datos generados el {fecha(datos.generado)}. Se vuelven a descargar en cada despliegue.
          </p>
          {datos.avisos.length > 0 && (
            <details className="mt-4 text-xs text-tinta-3">
              <summary className="cursor-pointer">Avisos de la última actualización ({datos.avisos.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                {datos.avisos.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
