"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/", label: "Congreso", icono: IconoCongreso },
  { href: "/diputados", label: "Diputados", icono: IconoPersonas },
  { href: "/senadores", label: "Senadores", icono: IconoPersona },
  { href: "/como-se-calcula", label: "Cómo se calcula", icono: IconoInfo },
];

/** Marca: el hemiciclo, tres filas de bancas. */
export function Marca({ className = "" }: { className?: string }) {
  const filas = [
    { r: 9, n: 7 },
    { r: 6.2, n: 5 },
    { r: 3.4, n: 3 },
  ];
  return (
    <svg viewBox="0 0 24 14" aria-hidden className={className}>
      {filas.flatMap(({ r, n }) =>
        Array.from({ length: n }, (_, i) => {
          const a = Math.PI - (Math.PI * i) / (n - 1);
          return <circle key={`${r}-${i}`} cx={12 + r * Math.cos(a)} cy={12.5 - r * Math.sin(a)} r={1.25} fill="currentColor" />;
        }),
      )}
      <rect x="10.4" y="11.2" width="3.2" height="2.6" rx="0.6" fill="var(--side-accent)" />
    </svg>
  );
}

export default function Shell({ children, actualizado }: { children: React.ReactNode; actualizado: string }) {
  const ruta = usePathname();
  const [menu, setMenu] = useState(false);
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));

  useEffect(() => {
    document.body.style.overflow = menu ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menu]);

  const navegacion = (
    <nav aria-label="Secciones" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icono: Icono }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMenu(false)}
          aria-current={activo(href) ? "page" : undefined}
          className={`flex h-11 items-center gap-2.5 rounded-lg px-3 text-[14px] transition-colors lg:h-8 ${
            activo(href) ? "bg-side-active font-medium text-side-ink" : "text-side-muted hover:bg-side-hover hover:text-side-ink"
          }`}
        >
          <Icono />
          {label}
        </Link>
      ))}
    </nav>
  );

  const pie = (
    <p className="px-3 text-[12px] leading-4 text-side-muted">
      Datos oficiales de HCDN, Senado y Ministerio de Economía.
      <br />
      Actualizados el {actualizado}.
    </p>
  );

  return (
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[240px_minmax(0,1fr)]">
      {/* Escritorio: barra lateral sobre el fondo */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 bg-side px-3 py-5 text-side-ink lg:flex">
        <Link href="/" className="flex items-center gap-2.5 px-3">
          <Marca className="h-[18px] w-[31px] shrink-0 text-side-ink" />
          <span className="leading-tight">
            <span className="block text-[14px] font-medium">Cuánto nos cuestan</span>
            <span className="block text-[12px] text-side-muted">Congreso de la Nación</span>
          </span>
        </Link>
        {navegacion}
        <div className="mt-auto">{pie}</div>
      </aside>

      {/* Teléfono y tablet: barra superior y menú en hoja completa */}
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between bg-side px-4 text-side-ink lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Marca className="h-[14px] w-[24px] text-side-ink" />
          <span className="text-[14px] font-medium">Cuánto nos cuestan</span>
        </Link>
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          aria-expanded={menu}
          aria-controls="menu-movil"
          className="-mr-2 grid size-11 place-items-center rounded-lg text-side-ink active:bg-side-hover"
        >
          <span className="sr-only">{menu ? "Cerrar menú" : "Abrir menú"}</span>
          <svg viewBox="0 0 20 20" className="size-5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            {menu ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
          </svg>
        </button>
      </header>
      {menu && (
        <div id="menu-movil" className="fixed inset-x-0 top-12 bottom-0 z-20 flex flex-col gap-6 bg-side px-3 py-4 text-side-ink lg:hidden">
          {navegacion}
          <div className="mt-auto pb-4">{pie}</div>
        </div>
      )}

      <div className="min-w-0">{children}</div>
    </div>
  );
}

function IconoBase({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
function IconoCongreso() {
  return (
    <IconoBase>
      <path d="M2 6.5L8 3l6 3.5M3 7v5.5M6.3 7v5.5M9.7 7v5.5M13 7v5.5M1.8 13.5h12.4" />
    </IconoBase>
  );
}
function IconoPersonas() {
  return (
    <IconoBase>
      <circle cx="6" cy="5.5" r="2.2" />
      <path d="M2 13c.4-2.3 2-3.6 4-3.6s3.6 1.3 4 3.6M10.5 3.6a2.1 2.1 0 010 4M12 9.6c1.1.4 1.8 1.6 2 3.4" />
    </IconoBase>
  );
}
function IconoPersona() {
  return (
    <IconoBase>
      <circle cx="8" cy="5.5" r="2.4" />
      <path d="M3.5 13.2c.5-2.5 2.3-3.9 4.5-3.9s4 1.4 4.5 3.9" />
    </IconoBase>
  );
}
function IconoInfo() {
  return (
    <IconoBase>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 7.3v3.6M8 5.1v.1" />
    </IconoBase>
  );
}
