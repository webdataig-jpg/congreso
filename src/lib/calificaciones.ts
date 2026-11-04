import "server-only";
import { Redis } from "@upstash/redis";

export interface Agregado {
  suma: number;
  cant: number;
}

interface Almacen {
  resumen(): Promise<Record<string, Agregado>>;
  /** Guarda (o reemplaza) el voto y devuelve el agregado actualizado de ese legislador. */
  votar(clave: string, votante: string, puntaje: number): Promise<Agregado>;
  /** Suma 1 al contador y devuelve el total dentro de la ventana. */
  contar(clave: string, ventanaSeg: number): Promise<number>;
}

const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

// Reemplaza el voto anterior del mismo votante sin contar dos veces.
const LUA_VOTAR = `
local anterior = redis.call('HGET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
if anterior then
  redis.call('HINCRBY', KEYS[2], ARGV[3], tonumber(ARGV[2]) - tonumber(anterior))
else
  redis.call('HINCRBY', KEYS[2], ARGV[3], tonumber(ARGV[2]))
  redis.call('HINCRBY', KEYS[3], ARGV[3], 1)
end
return {redis.call('HGET', KEYS[2], ARGV[3]), redis.call('HGET', KEYS[3], ARGV[3])}
`;

function redisAlmacen(redis: Redis): Almacen {
  return {
    async resumen() {
      const [suma, cant] = await Promise.all([
        redis.hgetall<Record<string, number>>("calif:suma"),
        redis.hgetall<Record<string, number>>("calif:cant"),
      ]);
      const out: Record<string, Agregado> = {};
      for (const [k, n] of Object.entries(cant ?? {})) {
        if (Number(n) > 0) out[k] = { suma: Number(suma?.[k] ?? 0), cant: Number(n) };
      }
      return out;
    },
    async votar(clave, votante, puntaje) {
      const [suma, cant] = await redis.eval<string[], [string | number, string | number]>(
        LUA_VOTAR,
        [`calif:votos:${clave}`, "calif:suma", "calif:cant"],
        [votante, String(puntaje), clave],
      );
      return { suma: Number(suma), cant: Number(cant) };
    },
    async contar(clave, ventanaSeg) {
      const k = `calif:limite:${clave}`;
      const n = await redis.incr(k);
      if (n === 1) await redis.expire(k, ventanaSeg);
      return n;
    },
  };
}

// Solo para desarrollo local sin Redis: se pierde al reiniciar.
function memoriaAlmacen(): Almacen {
  const g = globalThis as unknown as { __calif?: { votos: Map<string, Map<string, number>>; limites: Map<string, { n: number; hasta: number }> } };
  g.__calif ??= { votos: new Map(), limites: new Map() };
  const { votos, limites } = g.__calif;
  const agregado = (m?: Map<string, number>): Agregado => {
    let suma = 0;
    m?.forEach((v) => (suma += v));
    return { suma, cant: m?.size ?? 0 };
  };
  return {
    async resumen() {
      return Object.fromEntries([...votos].map(([k, m]) => [k, agregado(m)]));
    },
    async votar(clave, votante, puntaje) {
      if (!votos.has(clave)) votos.set(clave, new Map());
      votos.get(clave)!.set(votante, puntaje);
      return agregado(votos.get(clave));
    },
    async contar(clave, ventanaSeg) {
      const ahora = Date.now();
      const l = limites.get(clave);
      if (!l || l.hasta < ahora) {
        limites.set(clave, { n: 1, hasta: ahora + ventanaSeg * 1000 });
        return 1;
      }
      return ++l.n;
    },
  };
}

export const almacen: Almacen | null =
  url && token
    ? redisAlmacen(new Redis({ url, token }))
    : process.env.NODE_ENV !== "production"
      ? memoriaAlmacen()
      : null;

export const almacenEsMemoria = !(url && token);
