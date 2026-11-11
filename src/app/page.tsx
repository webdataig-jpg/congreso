import datosJson from "../../data/legisladores.json";
import type { Datos } from "@/lib/tipos";
import { construirFilas, costoLegisladores, gastoPorGrupo, resumenCongreso } from "@/lib/resumen";
import Link from "next/link";
import { $, $corto, bloqueLegible, fecha, int, millones, pct } from "@/lib/formato";
import { Avatar, Canvas, Muestra, Tarjeta, Titulo, VerTodo } from "@/components/ui";
import { GastoEnVivo } from "@/components/Vivo";
import { MejorCalificados, type Mini } from "@/components/Ranking";

const datos = datosJson as unknown as Datos;

export default function Congreso() {
  const r = resumenCongreso(datos);
  const filas = construirFilas(datos);
  const leg = costoLegisladores(filas);
  const caros = filas
    .filter((f) => f.camara === "senadores")
    .sort((a, b) => b.dietaMensual + b.asesoresMensual - (a.dietaMensual + a.asesoresMensual))
    .slice(0, 5);
  const mini: Mini[] = filas.map((f) => ({ camara: f.camara, id: f.id, nombre: f.nombre, apellido: f.apellido, distrito: f.distrito, foto: f.foto }));
  const nLeg = filas.length;

  if (!r) {
    return (
      <Canvas>
        <Titulo titulo="Congreso de la Nación" sub="No se pudo cargar el presupuesto del Congreso. Probá más tarde." />
      </Canvas>
    );
  }

  const shareLeg = leg.total / r.vigente;
  const max = Math.max(...r.organismos.map((o) => o.vigente));
  const grupos = (["Cámaras", "Servicios del Congreso", "Organismos de control"] as const).map((g) => ({
    grupo: g,
    items: r.organismos.filter((o) => o.grupo === g),
  }));

  return (
    <Canvas>
      <Titulo
        titulo={
          <>
            Congreso de la Nación <span className="font-normal text-muted">(así se gastan nuestros impuestos)</span>
          </>
        }
        sub={
          <>
            En {r.ejercicio} cuesta {millones(r.vigente)}: {millones(r.porDia)} por día. El {pct(r.sharePersonal, 0)} se va en
            sueldos; las dietas y los asesores de los {nLeg} legisladores son el {pct(shareLeg)}.
          </>
        }
        derecha={
          r.actualizado && (
            <a href={datos.presupuesto?.url} className="hover:text-ink hover:underline">
              Presupuesto al {fecha(r.actualizado)}
            </a>
          )
        }
      />

      {/* Cifras clave: un solo contenedor dividido */}
      <section aria-label="Cifras clave" className="grid grid-cols-2 rounded-lg border border-border bg-surface shadow-tarjeta lg:grid-cols-[1.3fr_repeat(4,1fr)]">
        <Cifra etiqueta={`Presupuesto ${r.ejercicio}`} valor={millones(r.vigente)} nota={`Inicial: ${millones(r.presupuestado)}`} lider />
        <Cifra
          etiqueta="Ya gastado"
          valor={millones(r.devengado)}
          nota={`${pct(r.ejecutado)} del presupuesto${r.actualizado ? `, al ${fecha(r.actualizado)}` : ""}`}
        />
        <Cifra etiqueta="Por día" valor={millones(r.porDia)} nota={`${$(r.porSegundo)} por segundo`} />
        <Cifra etiqueta="Por habitante" valor={$(r.porHabitante)} nota="al año, sobre el Censo 2022" />
        <Cifra etiqueta="Del presupuesto nacional" valor={pct(r.shareNacional, 2)} nota={`de ${millones(datos.presupuesto!.totalNacional.vigente)}`} />
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Bloque principal: el presupuesto por organismo */}
        <Tarjeta
          className="lg:col-span-8"
          cuerpoClassName="flex flex-col"
          titulo="Presupuesto por organismo"
          pie={
            <span className="flex flex-wrap justify-between gap-x-6 gap-y-1">
              <span className="text-muted">
                Crédito inicial {millones(r.presupuestado)}; ampliado a lo largo del año un {pct(r.vigente / r.presupuestado - 1, 0)}
              </span>
              <span>
                <span className="text-muted">Total vigente </span>
                <span className="num font-medium">{millones(r.vigente)}</span>
              </span>
            </span>
          }
          meta={
            <span className="flex flex-wrap gap-x-5 gap-y-1 text-[14px] leading-5 text-ink">
              <span className="flex items-center gap-1.5">
                <Muestra className="h-3 w-4 bg-hue" />
                <span className="font-medium">Gastado</span>
                <span className="num text-muted">{millones(r.devengado)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Muestra className="h-3 w-4 bg-hue-soft ring-1 ring-hue/40 ring-inset" />
                <span className="font-medium">Falta gastar</span>
                <span className="num text-muted">{millones(r.vigente - r.devengado)}</span>
              </span>
            </span>
          }
        >
          <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_6.5rem_3.5rem] gap-4 pb-1 text-[12px] text-muted sm:grid">
            <span>Organismo</span>
            <span />
            <span className="text-right">Vigente</span>
            <span className="text-right">Del total</span>
          </div>
          {grupos.map(({ grupo, items }) => (
            <div key={grupo} className="mt-2 flex flex-col first-of-type:mt-0" style={{ flexGrow: items.length }}>
              <p className="pt-2 pb-1 text-[12px] text-muted">{grupo}</p>
              <ul className="flex flex-1 flex-col">
                {items.map((o) => (
                  <li
                    key={o.id}
                    className="grid flex-1 grid-cols-[minmax(0,1fr)_auto] content-center items-center gap-x-4 gap-y-1.5 border-t border-rule py-[11px] sm:grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_6.5rem_3.5rem]"
                    title={`${o.nombre}: vigente ${millones(o.vigente)}, gastado ${millones(o.devengado)}, falta gastar ${millones(o.vigente - o.devengado)}`}
                  >
                    <span className="truncate">{o.corto}</span>
                    <span className="order-3 col-span-2 sm:order-none sm:col-span-1">
                      <span className="flex h-3 overflow-hidden rounded-[2px] ring-1 ring-hue/30 ring-inset" style={{ width: `${Math.max(1.5, (o.vigente / max) * 100)}%` }}>
                        <span className="h-full bg-hue" style={{ width: `${(o.devengado / o.vigente) * 100}%` }} />
                        <span className="h-full flex-1 bg-hue-soft" />
                      </span>
                    </span>
                    <span className="num text-right">{millones(o.vigente)}</span>
                    <span className="num hidden text-right text-muted sm:block">{pct(o.vigente / r.vigente)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Tarjeta>

        <div className="lg:col-span-4">
          <GastoEnVivo
            porSegundo={r.porSegundo}
            provincias={gastoPorGrupo(filas, "distrito")}
            partidos={gastoPorGrupo(filas, "bloque").map((b) => (b.fusion ? b : { ...b, nombre: bloqueLegible(b.nombre) }))}
          />
        </div>

        {/* Fila: en qué se gasta y los legisladores dentro del total */}
        <Tarjeta
          className="lg:col-span-6"
          titulo="En qué se gasta"
          meta="del presupuesto vigente"
        >
          <ul>
            {r.incisos.map((i, k) => (
              <li key={i.nombre} className="border-t border-rule py-2 first:border-t-0">
                <span className="flex justify-between gap-3">
                  <span className="truncate">{i.nombre}</span>
                  <span className="num shrink-0">{pct(i.vigente / r.vigente)}</span>
                </span>
                <span className="mt-1.5 block h-1.5 rounded-[2px] bg-raised">
                  <span
                    className={`block h-full rounded-[2px] ${k === 0 ? "bg-hue" : "bg-ink/70"}`}
                    style={{ width: `${Math.max(0.6, (i.vigente / r.vigente) * 100)}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta className="lg:col-span-6" titulo="Dietas y asesores en el total" meta="por año" pie={<VerTodo href="/como-se-calcula">Cómo se calcula</VerTodo>}>
          <div className="flex h-3 overflow-hidden rounded-[2px]" role="img" aria-label={`Dietas y asesores: ${pct(shareLeg)} del presupuesto del Congreso`}>
            <span className="h-full bg-hue" style={{ width: `${shareLeg * 100}%` }} />
            <span className="h-full flex-1 bg-raised" />
          </div>
          <p className="mt-2 flex flex-wrap justify-between gap-x-4 text-[12px] text-muted">
            <span>
              <Muestra className="bg-hue" /> Legisladores y asesores {pct(shareLeg)}
            </span>
            <span>
              <Muestra className="bg-raised" /> Resto del Congreso {pct(1 - shareLeg)}
            </span>
          </p>
          <table className="mt-3 w-full">
            <tbody>
              {leg.partes.map((p) => (
                <tr key={p.clave} className="border-t border-rule">
                  <td className="py-2">{p.nombre}</td>
                  <td className="num py-2 text-right">{millones(p.valor)}</td>
                  <td className="num w-16 py-2 text-right text-muted">{pct(p.valor / r.vigente)}</td>
                </tr>
              ))}
              <tr className="border-t border-border">
                <td className="py-2">Resto del Congreso</td>
                <td className="num py-2 text-right">{millones(r.vigente - leg.total)}</td>
                <td className="num w-16 py-2 text-right text-muted">{pct(1 - shareLeg)}</td>
              </tr>
            </tbody>
          </table>
        </Tarjeta>


        <Tarjeta className="lg:col-span-6" titulo="Los senadores que más cuestan" meta="por mes" pie={<VerTodo href="/senadores">Ver los {datos.senadores.lista.length} senadores</VerTodo>}>
          <ol>
            {caros.map((f, i) => (
              <li key={f.id} className="border-t border-rule first:border-t-0">
                <Link
                  href={`/senadores#legislador-${f.id}`}
                  className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-raised/60"
                >
                  <span className="num w-4 text-[12px] text-muted">{i + 1}.</span>
                  <Avatar foto={f.foto} nombre={f.nombre} apellido={f.apellido} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium group-hover:underline">
                      {f.apellido}, {f.nombre}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-[18px] text-ink">{bloqueLegible(f.bloque)}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {f.distrito} · {int(f.asesores)} asesores
                    </span>
                  </span>
                  <span className="num font-bold">{$corto(f.dietaMensual + f.asesoresMensual)}</span>
                </Link>
              </li>
            ))}
          </ol>
        </Tarjeta>

        <Tarjeta className="lg:col-span-6" titulo="Mejor calificados" meta="por los visitantes" pie={<VerTodo href="/diputados">Calificar a un legislador</VerTodo>}>
          <MejorCalificados lista={mini} />
        </Tarjeta>
      </div>
    </Canvas>
  );
}

function Cifra({ etiqueta, valor, nota, lider }: { etiqueta: string; valor: string; nota: string; lider?: boolean }) {
  return (
    <div
      className={`border-border px-5 py-4 [&:not(:first-child)]:border-t lg:[&:not(:first-child)]:border-t-0 lg:[&:not(:first-child)]:border-l ${
        lider ? "col-span-2 lg:col-span-1" : "[&:nth-child(odd)]:border-l"
      }`}
    >
      <p className="text-[13px] text-muted">{etiqueta}</p>
      <p className={`num mt-1 ${lider ? "text-[30px] leading-9 font-bold" : "text-[20px] leading-7 font-medium"}`}>{valor}</p>
      <p className="mt-0.5 text-[12px] leading-4 text-muted">{nota}</p>
    </div>
  );
}
