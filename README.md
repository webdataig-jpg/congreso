# ¿Cuánto nos cuestan?

Muestra, para cada diputado y senador nacional de Argentina:

- cuánto le queda de mandato (cuenta regresiva hasta el 9 de diciembre del último año),
- cuántos asesores tiene,
- cuánto cuesta mantenerlo por mes y en todo el mandato (dieta + asesores), cuánto ya costó y cuánto falta,
- su email, oficina y redes sociales (lo que publica cada Cámara),
- una calificación ciudadana de su gestión (1 a 5 estrellas, anónima).

Next.js para Vercel: la página es estática y las calificaciones usan una API (`/api/calificaciones`) con Upstash Redis.

## Datos

`scripts/update-data.mjs` descarga las fuentes oficiales y genera `data/legisladores.json`.
Corre automáticamente antes de cada build (`prebuild`). Si una fuente falla, se queda con la copia del JSON anterior
y lo anota en `avisos`, así que el build no se rompe.

| Dato | Fuente |
|---|---|
| Diputados en ejercicio y mandato | datos.hcdn.gob.ar · Composición actual de la Cámara |
| Dieta y gastos de representación de diputados | datos.hcdn.gob.ar · Remuneraciones |
| Personal de bloques (Diputados) | datos.hcdn.gob.ar · Nómina de personal |
| Escala salarial en módulos | datos.hcdn.gob.ar · Escala salarial |
| Senadores y mandato | senado.gob.ar · Datos abiertos (listado de senadores) |
| Asesores por senador y categoría | senado.gob.ar/senadores/senador/{id} · pestaña Personal |
| Email, oficina y redes de diputados | hcdn.gob.ar/diputados/{slug}/ (de a uno, con pausa) |
| Email, interno y redes de senadores | senado.gob.ar · Datos abiertos |
| Valor del módulo, dieta del Senado | `data/parametros.json` (a mano, ver abajo) |

### Lo que hay que actualizar a mano

`data/parametros.json` → `valorModulo` y `valorModuloVigencia`. El Senado publica la escala salarial como imagen
(senado.gob.ar → Transparencia → Escala salarial), así que no se puede leer de forma automática.
El script avisa si la dieta de HCDN deja de ser un múltiplo exacto del módulo configurado (hoy son 2.200 módulos),
que es la señal de que cambió.

### Contactos de diputados

HCDN bloquea las ráfagas de pedidos (responde 429/403). Por eso el script revisa como máximo
`CONTACTOS_MAX` páginas por corrida (40 por defecto), de a una con 1,5 s de pausa, empezando por las que nunca se
revisaron o tienen más de 30 días. Si HCDN frena, corta y sigue en la próxima corrida. Para una carga completa:
`CONTACTOS_MAX=300 npm run update-data` (≈7 min).

### Limitaciones

- **HCDN no publica los asesores de cada diputado.** Se reparte el personal de planta "afectado a bloque político"
  en partes iguales entre los 257 diputados. Es un promedio, no el dato individual.
- Los sueldos de asesores son un piso: módulos de la categoría + suplemento RC, sin antigüedad, títulos, presentismo
  ni capacitación. No incluye contratos de locación, pasajes, viáticos ni gastos de despacho.
- Aguinaldo y contribuciones patronales son opcionales y los elige quien mira la página.
- Montos a valores actuales, sin proyectar aumentos.

## Desarrollo

```bash
npm install
npm run update-data   # baja los datos (≈20 s)
npm run dev
```

## Calificaciones

- Se guardan en Upstash Redis: hashes `calif:suma` y `calif:cant` (agregados) y `calif:votos:{camara}:{id}` (un voto por votante).
- El votante se identifica con una cookie anónima (`votante`); se guarda solo su hash. Se puede cambiar el voto.
- Límites por IP (hasheada): 5 votos por legislador por día y 120 por hora.
- Sin Redis configurado: en desarrollo se usa memoria (se pierde al reiniciar); en producción la calificación se muestra como no disponible.
- Variables: `KV_REST_API_URL` y `KV_REST_API_TOKEN` (las crea Vercel al conectar Upstash) o `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Opcional: `CALIFICACIONES_SAL` para el hash.
- No es una encuesta representativa: sin login, alguien decidido puede votar más de una vez (borrando cookies y cambiando de red).

## Despliegue en Vercel

1. Subir el repo a GitHub e importarlo en vercel.com (framework: Next.js).
2. En el proyecto de Vercel: Storage → Marketplace → **Upstash (Redis)** → crear y conectar. Eso agrega las variables `KV_REST_API_*`. Redeploy.
3. Cada deploy vuelve a descargar los datos.
4. `.github/workflows/actualizar-datos.yml` actualiza el JSON todos los lunes y hace commit si hay cambios,
   lo que dispara un nuevo deploy en Vercel.
