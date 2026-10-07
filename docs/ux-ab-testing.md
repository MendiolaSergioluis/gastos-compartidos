# Análisis UX/UI y plan de A/B testing

Segunda pasada sobre la interfaz, centrada en **espaciado, jerarquía y controles**, más un plan
honesto de experimentación: qué se puede medir hoy, qué no, y qué se cambió por criterio sin
esperar a datos.

---

## 1. Lo que estaba mal (y cómo quedó)

### Elementos pulsables demasiado juntos

Era el problema más visible: en la lista de gastos había **cuatro botones con 4 px de separación**
(Editar · Duplicar · Archivar · Eliminar), y en Ajustes cinco botones de datos con 8 px. Con el
dedo, «Archivar» y «Eliminar» quedaban a un milímetro.

Ahora hay una **escala de espacio** con una regla explícita: 4 px solo *dentro* de una unidad
acoplada (pastilla, control segmentado, etiqueta+valor); **8 px como mínimo entre controles
adyacentes**; 12 px entre grupos; 24 px entre tarjetas; 32 px entre secciones. Además la acción
destructiva se separa del resto:

```css
.expense__actions { gap: var(--space-2); }          /* 8 px, antes 4 */
.expense__actions .btn--danger { margin-left: var(--space-2); }
```

Y los botones crecieron de 28 px a 36 px de alto (`btn--sm`) y 44 px (`btn`), por encima del
mínimo táctil recomendado.

### Jerarquía de controles

- **Acento reservado**: el violeta solo marca interacción o selección. Los datos usan sus colores
  (personas, categorías, metas). Antes el violeta era a la vez marca, dato, estado y botón.
- **Un solo lenguaje de forma**: pastillas para lo seleccionable, `radius-lg` para filas y grupos,
  `radius-xl` para tarjetas y cabecera.
- **Cabecera unificada**: la barra superior tenía bordes rectos y ocupaba todo el ancho, rompiendo
  con el resto. Ahora es una tarjeta flotante con el mismo radio, sombra y borde que las demás, y
  la barra inferior del móvil también.

### Controles nativos

Cada `<select>`, `<input type="month">` y `<input type="color">` se veía distinto en cada sistema
y rompía el estilo. Se sustituyeron por componentes propios:

| Antes | Ahora |
| --- | --- |
| `<select>` | `Select`: botón + panel en portal, teclado completo, letra inicial |
| `<input type="month">` | `MonthPicker`: rejilla de 12 meses con navegación de año |
| `<input type="color">` | `ColorPicker`: paleta curada, sin diálogo del sistema |
| `confirm()` | Aviso con **Deshacer** (ya venía de la iteración anterior) |
| `alert()` | Aviso tipo toast |

El panel de los desplegables se dibuja en un **portal con posición fija**: si no, lo recortaría el
`overflow` de las tarjetas o lo atraparía el `transform` del hover de las filas.

### Textos repetidos y micro-copy

- «Proporcional al sueldo» → **«Proporcional»**; «Mitad y mitad» → **«Partes iguales»**. Más cortos
  y sin ambigüedad en columnas estrechas.
- «Quedar en paz» desapareció junto con el sistema de deudas (ver más abajo).
- Se eliminó la duplicación del porcentaje en el hero (anillo + degradado gigante).

### Densidad en móvil

Verificado a 390 px reales (con emulación por CDP, no con `--window-size`, que en macOS no baja de
500 px y da una imagen recortada que engaña). Sin desborde horizontal, cabecera en dos filas con el
selector de mes a ancho completo, y barra inferior con los seis destinos.

## 2. Lo que cambió por criterio de producto, no por test

- **Fuera el sistema de deudas.** «Pagó» y «quedar en paz» obligaban a resolver transferencias con
  montos desiguales. Ahora cada persona aporta su porción a un **fondo común** y desde ahí se pagan
  las facturas: nadie le debe a nadie. Además del modelo, elimina una fuente de fricción social
  (reclamar dinero) que es justo lo que hace abandonar estas apps.
- **Metas personalizables.** Antes dos porcentajes fijos (personal y vacaciones). Ahora una lista
  con nombre, %, color e icono: aporte a los padres, iglesia, caridad, estudios…
- **Multi-grupo.** El nombre y todos los textos hablan de «grupo»: parejas, familias, compañeros de
  piso. El cálculo ya era genérico (`% = gastos ÷ Σ sueldos`), solo faltaba el envoltorio.

## 3. Plan de A/B testing

**Punto de partida honesto:** esta app no tiene servidor ni analítica. No hay forma de asignar
variantes ni de medir conversión con usuarios reales hoy. Lo que sigue es un plan ejecutable, con
lo que sí se puede hacer ya y lo que requiere instrumentar.

### 3.1 Instrumentación mínima (antes de cualquier test)

Un módulo `src/domain/telemetry.ts` que guarde **contadores locales** en `localStorage`
(nada sale del dispositivo, coherente con la promesa de privacidad):

```ts
type Event =
  | 'month_opened' | 'salary_edited' | 'bill_marked_paid'
  | 'contribution_confirmed' | 'goal_created' | 'advice_clicked'
  | 'expense_created' | 'export_used'
```

Con eso ya se pueden medir **tiempos hasta el primer valor** en pruebas moderadas, sin servidor.

### 3.2 Experimentos candidatos

| # | Hipótesis | Variante A | Variante B | Métrica primaria |
| --- | --- | --- | --- | --- |
| E1 | Un panel de acciones aumenta la tasa de meses «cerrados» | resumen solo con datos (actual) | resumen con «Qué hacer ahora» | % de meses con todas las facturas marcadas |
| E2 | El fondo común reduce el abandono frente a las deudas | fondo común (actual) | «quedar en paz» con transferencias | sesiones hasta completar un mes |
| E3 | Los iconos propios mejoran el reconocimiento | iconos generados (actual) | emoji | tiempo hasta encontrar un gasto en la lista |
| E4 | El anillo comunica mejor que una cifra | anillo (actual) | cifra grande sin anillo | recuerdo del % tras 5 s |
| E5 | Confirmar al salir del campo evita errores | commit on blur (actual) | commit en cada tecla | número de correcciones por sesión |
| E6 | Deshacer en lugar de preguntar reduce fricción | deshacer (actual) | `confirm()` bloqueante | acciones destructivas por sesión |
| E7 | Metas personalizables aumentan el uso de la pestaña | metas libres (actual) | dos metas fijas | número de metas creadas por usuario |

E1, E2, E5 y E6 son los de mayor impacto potencial: tocan la razón por la que alguien deja de usar
la app (no saber qué hacer, fricción social, errores de captura, miedo a romper algo).

### 3.3 Diseño de los tests

- **Unidad de aleatorización**: el dispositivo (no la sesión), para que la experiencia sea estable.
  Con `localStorage` basta: `variant = hash(deviceId) % 2`.
- **Métrica principal única** por experimento y una guardia (por ejemplo, tiempo por sesión) para
  detectar que la variante no rompe algo.
- **Tamaño**: para detectar un cambio de 10 puntos porcentuales en una métrica base del 30 % hace
  faltan ~350 observaciones por variante (α = 0,05, potencia 0,8). Con pocos usuarios, mejor
  **pruebas cualitativas moderadas** (5-8 personas haciendo tres tareas) que un test sin potencia.
- **Duración**: mínimo dos ciclos mensuales completos, porque el producto es mensual por naturaleza.
  Un test de tres días mide curiosidad, no hábito.

### 3.4 Qué mirar mientras no haya datos

Métricas de producto que sí se pueden estimar con uso propio y de la pareja/grupo:

- **Tiempo hasta el primer valor**: abrir la app → tener el % del mes. Objetivo: < 60 s la primera
  vez (los datos de ejemplo existen justo para eso).
- **Tasa de meses cerrados**: meses con todas las facturas marcadas y aportes confirmados sobre
  meses abiertos.
- **Errores de captura**: correcciones de un mismo campo en la misma sesión.

## 4. Verificación aplicada

- 82 pruebas automáticas (motor, metas, fondo común, migración, reducer y recorrido de la interfaz
  real en jsdom, incluido el desplegable propio: abrir, listar, elegir y comprobar que el cálculo
  reacciona).
- Capturas reales a 1440 px y 390 px, en tema claro y oscuro, con emulación por CDP.
- `oxlint` sin avisos y `tsc` sin errores.
- Sin desborde horizontal comprobado con el ancho real del documento (`scrollWidth === clientWidth`).

---

## 4. Investigación comparativa

Cómo resuelven esto Splitwise, Tricount, Splid y Settle Up. Fuente principal: una comparativa hecha
**probando las cuatro apps** con cuentas reales
([Tricount vs Splitwise vs Settle Up, 2026](https://tetras-ltd.com/en/blog/tricount-vs-splitwise-vs-settle-up-best-app)).
Lo que se aprendió y lo que se aplicó.

| Patrón observado | Qué dicen | Nuestra situación |
| --- | --- | --- |
| **Vista previa en vivo al escribir el monto** | Tricount: «al escribir el total mostró al instante cuánto ponía cada uno; detectas el error antes de guardar, no después» — lo mejor de su clase | Lo teníamos en la fila del mes, **no en el formulario**. **Aplicado**: el formulario ahora muestra el reparto resultante con el % de cada sueldo |
| **Ratios que se recuerdan** | Solo Settle Up guarda un «Default share» por miembro; en las demás hay que reelegir el reparto en cada gasto, y Splitwise lo reserva a Pro | **Ya somos mejores**: el reparto es una propiedad del gasto, y el proporcional es el defecto. No hay nada que reelegir |
| **«¿Por qué me toca esto?»** | Settle Up: «el número aparece sin su razonamiento»; la comparativa premia la vista desglosada | **Reforzado**: en el detalle, cada fila indica el modo de reparto y el % aplicado, además de la fórmula en el hero |
| **Exportar** | Splid (PDF/Excel) y Settle Up (CSV/Excel) lo tienen; Tricount lo quitó en 2024 y es su queja más repetida | Solo teníamos JSON, que sirve para respaldar pero no para analizar. **Aplicado**: exportación CSV con una fila por gasto y mes, con el aporte de cada persona |
| **Codificaciones ambiguas** | Las «burbujas de saldo» de Settle Up confundieron al revisor: no sabía si un burbuja grande significaba «debe mucho» o «pagó mucho» | Valida la decisión de quitar el sistema de deudas: el fondo común se muestra con etiquetas explícitas (transferido, pendiente, pagado, disponible) |
| **Igualar gastos con ratios estables** | La comparativa concluye que casi todo el mundo divide a partes iguales y que las herramientas con ratios están pensadas para «compañeros de piso o parejas que dividen por ingresos» | Es exactamente nuestro caso de uso principal, y ya viene por defecto |
| **Grupos que no instalan nada** | Se señala como la gran barrera: en Splitwise todos necesitan cuenta | La PWA se instala o se abre en el navegador; los datos viven en el dispositivo. No hay registro |

### Lo que **no** se copia

- **Saldo entre personas y «simplificar deudas»**: es el núcleo de las otras cuatro y justo lo que
  este proyecto decidió no tener (ver §2). El fondo común elimina la fricción social de reclamar
  dinero, que es lo que hace abandonar estas apps.
- **Múltiples pagadores por gasto**: solo tiene sentido cuando hay deudas entre personas.
- **Cuentas, sincronización y pagos integrados**: rompen la promesa de privacidad (todo local) y
  añaden un servidor que hoy no hace falta.
