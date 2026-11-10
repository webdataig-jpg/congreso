const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const entero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal1 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export const $ = (n: number) => pesos.format(n);
export const int = (n: number) => entero.format(n);
export const dec = (n: number) => decimal1.format(n);

/** Monto abreviado: $ 12,3 M · $ 1.234 M · $ 2,1 mil M */
export function $corto(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e12) return `$ ${dec(n / 1e12)} billones`;
  if (abs >= 1e9) return `$ ${int(n / 1e6)} M`;
  if (abs >= 1e6) return `$ ${dec(n / 1e6)} M`;
  return $(n);
}

export function fecha(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00-03:00`).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export function plural(n: number, uno: string, varios: string) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Monto expresado en millones de pesos: $ 923.398 M */
export const millones = (n: number) => `$ ${int(n)} M`;

export function pct(x: number, decimales = 1) {
  return `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: decimales, maximumFractionDigits: decimales }).format(x * 100)}%`;
}

const SIGLAS = new Set(["UCR", "PRO", "MID", "PTS"]);
const MENORES = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "por", "en", "a"]);
const TILDES: Record<string, string> = { coalicion: "Coalición", civica: "Cívica", produccion: "Producción" };

/** Nombre de bloque legible: "UCR - UNIÓN CÍVICA RADICAL" → "UCR - Unión Cívica Radical". */
export function bloqueLegible(b: string): string {
  return b
    .trim()
    .split(/(\s+|-)/)
    .map((w, i) => {
      if (!/\p{L}/u.test(w)) return w;
      if (SIGLAS.has(w)) return w;
      const min = w.toLocaleLowerCase("es");
      if (TILDES[min]) return TILDES[min];
      if (i > 0 && MENORES.has(min)) return min;
      return min.charAt(0).toLocaleUpperCase("es") + min.slice(1);
    })
    .join("");
}
