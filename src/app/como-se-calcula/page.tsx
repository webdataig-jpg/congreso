import type { Metadata } from "next";
import { datos } from "@/lib/datos";
import { $, dec, fecha, int } from "@/lib/formato";
import { Canvas, Tarjeta, Titulo } from "@/components/ui";

export const metadata: Metadata = {
  title: "Cómo se calcula",
  description: "Fuentes oficiales, fórmulas y limitaciones de los costos de diputados, senadores y del Congreso.",
};

function Enlace({ href, children }: { href: string | null | undefined; children: React.ReactNode }) {
  return href ? (
    <a href={href} target="_blank" rel="noreferrer" className="underline decoration-control underline-offset-2 hover:decoration-ink">
      {children}
    </a>
  ) : (
    <>{children}</>
  );
}

export default function ComoSeCalcula() {
  const p = datos.parametros;
  const act = (s: string | null | undefined) => (s ? ` · ${fecha(s)}` : "");
  const items: { t: string; d: React.ReactNode }[] = [
    {
      t: "Presupuesto del Congreso",
      d: (
        <>
          Crédito vigente del Poder Legislativo Nacional (jurisdicción 01) en el presupuesto {datos.presupuesto?.ejercicio}, por organismo,
          según el dataset de crédito y ejecución del Ministerio de Economía. «Ya gastado» es el devengado a la fecha de corte. Incluye las
          dos Cámaras, sus servicios (Biblioteca, Imprenta, obra social del personal, Oficina de Presupuesto) y los organismos de control que
          dependen del Congreso (Auditoría General, Defensorías, Procuración Penitenciaria). El costo por habitante usa la población del
          Censo 2022 ({int(p.poblacion)} personas).
        </>
      ),
    },
    {
      t: "Mandato",
      d: "Los diputados duran 4 años y los senadores 6. Todos terminan el 9 de diciembre del último año. El tiempo restante se cuenta en hora argentina hasta ese día inclusive; si alguien asumió como reemplazo, desde que asumió.",
    },
    {
      t: "Dieta de diputados",
      d: (
        <>
          Dieta más gastos de representación según la planilla de remuneraciones de HCDN: {$(datos.dietaDiputado.dieta)} +{" "}
          {$(datos.dietaDiputado.gastosRepresentacion)}. No se suman desarraigo ni movilidad porque dependen de cada diputado y HCDN no
          informa quién los cobra.
        </>
      ),
    },
    {
      t: "Dieta de senadores",
      d: `${int(p.modulosDietaSenador)} módulos: ${p.modulosDietaSenadorDetalle}. Algunos senadores renunciaron a aumentos y pueden cobrar menos.`,
    },
    {
      t: "Sueldo de cada asesor",
      d: (
        <>
          Módulos de su categoría en la escala de la Ley 24.600 (dedicación funcional + sueldo básico) más el suplemento de{" "}
          {dec(p.modulosRC)} módulos, por el valor del módulo ({p.valorModulo.toLocaleString("es-AR")} desde {p.valorModuloVigencia}). No se
          suman antigüedad, títulos, presentismo ni capacitación porque varían por persona: el costo real es mayor.
        </>
      ),
    },
    {
      t: "Asesores de senadores",
      d: "El personal que el Senado declara en la página de cada senador, con su categoría. Los contratos de locación de servicios no figuran ahí.",
    },
    {
      t: "Asesores de diputados",
      d: "HCDN no publica el personal por despacho. Se usa el personal de planta «afectado a bloque político» de la nómina oficial, repartido en partes iguales entre los diputados. No incluye contratados.",
    },
    {
      t: "Aguinaldo y contribuciones",
      d: "Opcionales, desde el botón «Cálculo» de cada lista. El aguinaldo suma un sueldo por año; las contribuciones patronales se aplican sobre el bruto a la tasa que elijas, porque no se publica.",
    },
    {
      t: "Contacto y redes",
      d: "Los publica cada Cámara en la página oficial de cada legislador; si un despacho no los cargó, no aparecen.",
    },
    {
      t: "Calificaciones",
      d: "Opiniones anónimas de quienes visitan el sitio, no una encuesta representativa. Un voto por persona y legislador (se puede cambiar), con límites por conexión para evitar votos masivos.",
    },
    {
      t: "Lo que no incluye el costo por legislador",
      d: "Pasajes, viáticos, gastos de funcionamiento del despacho, personal de comisiones y de la administración de cada Cámara. Todo eso sí está dentro del presupuesto del Congreso.",
    },
  ];

  return (
    <Canvas>
      <Titulo titulo="Cómo se calcula" sub="Fuentes oficiales, fórmulas y lo que queda afuera. Montos a valores de hoy, sin proyectar aumentos." />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Tarjeta className="lg:col-span-8" titulo="Metodología">
          <dl>
            {items.map((i) => (
              <div key={i.t} className="grid gap-1 border-t border-rule py-3 first:border-t-0 sm:grid-cols-[13rem_minmax(0,1fr)] sm:gap-6">
                <dt className="font-medium">{i.t}</dt>
                <dd className="leading-6 text-muted">{i.d}</dd>
              </div>
            ))}
          </dl>
        </Tarjeta>
        <div className="flex flex-col gap-3 lg:col-span-4">
          <Tarjeta titulo="Fuentes">
            <ul className="leading-6">
              {[
                { href: datos.presupuesto?.url, t: "Economía · Crédito y ejecución del presupuesto", a: datos.presupuesto?.actualizado },
                { href: datos.diputados.url, t: "HCDN · Composición actual de la Cámara", a: datos.diputados.actualizado },
                { href: datos.dietaDiputado.url, t: "HCDN · Remuneraciones de diputados", a: datos.dietaDiputado.actualizado },
                { href: datos.personalDiputados?.url, t: "HCDN · Nómina de personal", a: datos.personalDiputados?.actualizado },
                { href: datos.escala.url, t: "HCDN · Escala salarial en módulos", a: datos.escala.actualizado },
                { href: datos.senadores.url, t: "Senado · Listado de senadores", a: datos.senadores.actualizado },
                { href: p.modulosDietaSenadorFuente, t: "Senado · Dietas y gastos de representación", a: null },
                { href: p.valorModuloFuente, t: "Senado · Escala salarial y valor del módulo", a: null },
              ].map((x) => (
                <li key={x.t} className="border-t border-rule py-2 first:border-t-0">
                  <Enlace href={x.href}>{x.t}</Enlace>
                  <span className="text-[12px] text-muted">{act(x.a)}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
          <Tarjeta titulo="Actualización" className="flex-1">
            <p className="leading-6 text-muted">
              Los datos se descargan en cada despliegue y todos los lunes. Última descarga: {fecha(datos.generado)}. El código está en{" "}
              <Enlace href="https://github.com/webdataig-jpg/congreso">GitHub</Enlace>.
            </p>
            {datos.avisos.length > 0 && (
              <details className="mt-3 text-[12px] text-muted">
                <summary className="cursor-pointer">Avisos de la última descarga ({datos.avisos.length})</summary>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {datos.avisos.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </details>
            )}
          </Tarjeta>
        </div>
      </div>
    </Canvas>
  );
}
