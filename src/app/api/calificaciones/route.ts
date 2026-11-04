import { createHash, randomUUID } from "node:crypto";
import { connection, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import datos from "../../../../data/legisladores.json";
import { almacen } from "@/lib/calificaciones";

const VALIDAS = new Set([
  ...datos.diputados.lista.map((d) => `diputados:${d.id}`),
  ...datos.senadores.lista.map((s) => `senadores:${s.id}`),
]);

// Límites por IP (anónimo, sin login): evitan el voto masivo desde un mismo lugar
// sin bloquear a quienes comparten conexión (oficinas, datos móviles).
const MAX_POR_IP_Y_LEGISLADOR_DIA = 5;
const MAX_POR_IP_HORA = 120;

const SAL = process.env.CALIFICACIONES_SAL ?? process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "local";
const hash = (s: string) => createHash("sha256").update(`${SAL}:${s}`).digest("base64url").slice(0, 22);

function ipDe(req: NextRequest) {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "0.0.0.0";
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function GET() {
  await connection();
  if (!almacen) return json({ disponible: false, resumen: {} });
  try {
    const resumen = await almacen.resumen();
    return json({ disponible: true, resumen }, 200, {
      // La CDN de Vercel lo guarda unos segundos para no consultar Redis en cada visita
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
    });
  } catch {
    return json({ disponible: false, resumen: {} }, 503);
  }
}

export async function POST(req: NextRequest) {
  if (!almacen) return json({ error: "Las calificaciones no están habilitadas." }, 503);

  // Solo desde la propia página
  const origen = req.headers.get("origin");
  if (origen && new URL(origen).host !== req.headers.get("host")) {
    return json({ error: "Origen no permitido." }, 403);
  }

  let cuerpo: { camara?: unknown; id?: unknown; puntaje?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return json({ error: "Pedido inválido." }, 400);
  }
  const clave = `${cuerpo.camara}:${cuerpo.id}`;
  const puntaje = Number(cuerpo.puntaje);
  if (!VALIDAS.has(clave) || !Number.isInteger(puntaje) || puntaje < 1 || puntaje > 5) {
    return json({ error: "Pedido inválido." }, 400);
  }

  const jar = await cookies();
  let votante = jar.get("votante")?.value;
  if (!votante || !/^[\w-]{20,40}$/.test(votante)) {
    votante = randomUUID();
    jar.set("votante", votante, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 400,
      path: "/",
    });
  }

  try {
    const ip = hash(ipDe(req));
    const dia = new Date().toISOString().slice(0, 10);
    const [porLegislador, porHora] = await Promise.all([
      almacen.contar(`${ip}:${clave}:${dia}`, 60 * 60 * 26),
      almacen.contar(`${ip}:h`, 60 * 60),
    ]);
    if (porLegislador > MAX_POR_IP_Y_LEGISLADOR_DIA || porHora > MAX_POR_IP_HORA) {
      return json({ error: "Demasiados votos desde esta conexión. Probá más tarde." }, 429);
    }
    const agregado = await almacen.votar(clave, hash(votante), puntaje);
    return json({ ok: true, clave, puntaje, agregado });
  } catch {
    return json({ error: "No se pudo guardar el voto. Probá de nuevo." }, 503);
  }
}
