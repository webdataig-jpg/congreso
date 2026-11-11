import Link from "next/link";

/*
  Piezas compartidas del estilo. Grilla del canvas: a 1440px, 1440 - 240 (barra) - 2 x 32 (márgenes)
  = 1136px de contenido = 12 columnas x 83,67 + 11 x 12 de separación. Todos los bloques caen en esas líneas.
*/

export function Canvas({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto w-full max-w-[1240px] px-4 pt-5 pb-16 sm:px-6 lg:px-8 lg:pt-9">{children}</main>;
}

export function Titulo({ titulo, sub, derecha }: { titulo: React.ReactNode; sub?: React.ReactNode; derecha?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[22px] leading-7 font-medium tracking-[-0.01em] sm:text-[24px] sm:leading-8">{titulo}</h1>
        {sub && <p className="mt-1 text-[14px] leading-5 text-muted sm:text-[15px] sm:leading-6">{sub}</p>}
      </div>
      {derecha && <div className="text-[12px] text-muted">{derecha}</div>}
    </div>
  );
}

export function Tarjeta({
  titulo,
  meta,
  children,
  className = "",
  pie,
  id,
  cuerpoClassName = "",
}: {
  titulo?: React.ReactNode;
  meta?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  pie?: React.ReactNode;
  id?: string;
  cuerpoClassName?: string;
}) {
  return (
    <section id={id} className={`flex min-w-0 flex-col rounded-lg border border-border bg-surface shadow-tarjeta ${className}`}>
      {(titulo || meta) && (
        <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-3">
          {titulo && <h2 className="text-[16px] leading-6 font-medium">{titulo}</h2>}
          {meta && <div className="text-[12px] text-muted">{meta}</div>}
        </header>
      )}
      <div className={`flex-1 px-5 pb-4 ${cuerpoClassName}`}>{children}</div>
      {pie && <footer className="border-t border-rule px-5 py-3 text-[13px]">{pie}</footer>}
    </section>
  );
}

export function VerTodo({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 font-medium text-ink hover:underline">
      {children}
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M6 3.5L10.5 8 6 12.5" />
      </svg>
    </Link>
  );
}

/** Muestra de leyenda: el mismo trazo que la marca que explica. */
export function Muestra({ className }: { className: string }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-[2px] align-middle ${/h-\d/.test(className) ? "" : "h-2 w-3"} ${className}`} />;
}

export function Avatar({ foto, nombre, apellido, size = 32 }: { foto: string | null; nombre: string; apellido: string; size?: number }) {
  const st = { width: size, height: size };
  return foto ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={foto} alt="" width={size} height={size} loading="lazy" style={st} className="shrink-0 rounded-full bg-raised object-cover" />
  ) : (
    <span aria-hidden style={st} className="grid shrink-0 place-items-center rounded-full bg-raised text-[11px] font-medium text-muted">
      {(apellido[0] ?? "") + (nombre[0] ?? "")}
    </span>
  );
}
