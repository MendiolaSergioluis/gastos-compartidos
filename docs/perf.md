# Rendimiento medido

Números reales, no impresiones. Se miden con `node scripts/cdp-perf.mjs`, que instala
observadores **antes** de que cargue la página (`initScript`) y luego lee LCP, CLS, tareas largas y
recursos.

## Resultado

| | primera visita (fría) | visita con caché |
| --- | --- | --- |
| FCP / LCP (móvil 390 px) | ~2,5 s | **84–216 ms** |
| FCP / LCP (escritorio 1440 px) | ~1,7 s | **84–168 ms** |
| CLS | **0** | **0** |
| Tareas largas (>50 ms) | ninguna | ninguna |
| Transferido en frío | ~372 kB | 0 kB |
| Bundle JS | 94,2 kB gzip | |
| CSS | 8,3 kB gzip | |

Lo que domina la primera visita es **la descarga del paquete**, no el render: en cuanto los archivos
están en caché (o instalados como PWA), el primer pintado baja a menos de 200 ms. El CLS es 0 porque
todas las animaciones de entrada usan `transform` y `opacity`, que no provocan desplazamiento.

## El troceado por ruta se probó y se descartó

Se implementó carga diferida por sección (`React.lazy` + `Suspense` + precarga en segundo plano) y
se midió:

| | paquete único | troceado por ruta |
| --- | --- | --- |
| Camino crítico (JS gzip) | 94,2 kB | ~88 kB |
| Transferido en frío | 372 kB | 332 kB (−11 %) |
| LCP móvil en frío | 2.644 ms | 2.532 ms (−4 %) |
| Peticiones en la primera visita | 1 JS | 5 JS |
| Entradas en el precaché | 40 | 50 |

La ganancia es de **~100 ms en el primer pintado**, y no se traslada al uso normal: el service
worker **precachea todo igual**, así que la descarga total no baja y el uso offline no mejora. A
cambio hay que mantener carga diferida, un `Suspense` con su hueco reservado y pruebas que esperan a
los trozos.

**Decisión: se revierte.** La medición no justificaba la complejidad. Si algún día el paquete pasa
de ~200 kB gzip, la conclusión cambiaría y el punto de partida está en el historial.

## Lo que sí se queda

- `prefers-reduced-motion` respetado en todas las animaciones.
- Iconos como `mask-image`: un PNG de 256 px sirve para cualquier tamaño y color, en vez de un
  sprite o una fuente de iconos.
- Sin fuentes externas: solo la pila del sistema, así que no hay parpadeo de texto ni peticiones
  bloqueantes.
- `content-visibility` no se usa: con una sola pantalla visible no aporta y complica el cálculo de
  alturas.

## Cómo volver a medirlo

```bash
npm run build
node scripts/shot.mjs "http://localhost:4174/" /dev/null 1440 900   # servidor de estáticos
node scripts/cdp-perf.mjs "http://localhost:4174/"
```

El script mide dos veces por dispositivo: la primera con `ignoreCache` (fría) y la segunda
aprovechando la caché, que es el estado real de una PWA instalada.
