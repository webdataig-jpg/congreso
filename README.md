# ¿Cuánto nos cuestan?

Muestra, para cada diputado y senador nacional de Argentina:

- cuánto le queda de mandato (cuenta regresiva hasta el 9 de diciembre del último año),
- cuántos asesores tiene,
- cuánto cuesta mantenerlo por mes y en todo el mandato (dieta + asesores), cuánto ya costó y cuánto falta.

Next.js estático, pensado para Vercel.

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
| Valor del módulo, dieta del Senado | `data/parametros.json` (a mano, ver abajo) |

### Lo que hay que actualizar a mano

`data/parametros.json` → `valorModulo` y `valorModuloVigencia`. El Senado publica la escala salarial como imagen
(senado.gob.ar → Transparencia → Escala salarial), así que no se puede leer de forma automática.
El script avisa si la dieta de HCDN deja de ser un múltiplo exacto del módulo configurado (hoy son 2.200 módulos),
que es la señal de que cambió.

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

## Despliegue en Vercel

1. Subir el repo a GitHub e importarlo en vercel.com (framework: Next.js, sin variables de entorno).
2. Cada deploy vuelve a descargar los datos.
3. `.github/workflows/actualizar-datos.yml` actualiza el JSON todos los lunes y hace commit si hay cambios,
   lo que dispara un nuevo deploy en Vercel.
