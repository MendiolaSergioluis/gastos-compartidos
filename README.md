# Gastos Compartidos

Aplicación web instalable (**PWA**, funciona sin conexión) para repartir los gastos comunes
**en proporción al sueldo de cada persona**, en lugar de dividir todo a partes iguales.
Sirve para **parejas, familias y compañeros de piso**.

```
% = Gastos compartidos ÷ (sueldo₁ + sueldo₂ + …)
aporteᵢ = sueldoᵢ × %
```

Con 2.441 de gastos sobre 5.000 de ingreso, el porcentaje es **48,82 %**: quien gana 3.000 aporta
1.464,60 y quien gana 2.000 aporta 976,40. Nadie pone la misma cantidad, pero **los dos ponen el
mismo porcentaje de su sueldo**, que es lo que hace justo el reparto.

---

## Cómo usarla

### 1. Abrirla

Si ya está publicada, abre la dirección en el navegador. Para levantarla en tu equipo:

```bash
npm install
npm run build     # genera dist/
npm run preview   # la sirve en http://localhost:4173
```

> El service worker (lo que permite usarla sin conexión) necesita `https://` o `localhost`.
> Abrir el `index.html` con doble clic funciona, pero sin instalación ni modo offline.

### 2. Instalarla como app

No hay tiendas ni cuentas: se instala desde el propio navegador.

| Plataforma | Cómo |
| --- | --- |
| **Android** (Chrome) | Menú ⋮ → **Instalar aplicación** (o el aviso «Añadir a pantalla de inicio») |
| **iPhone / iPad** (Safari) | Botón **Compartir** → **Añadir a pantalla de inicio** |
| **Escritorio** (Chrome/Edge) | Icono de instalar en la barra de direcciones, o menú → **Instalar Gastos Compartidos** |

Queda con su icono, se abre a pantalla completa (sin barra del navegador) y **arranca sin
conexión**. Al mantener pulsado el icono en Android aparecen atajos directos a *Mes*, *Gastos* y
*Metas*.

### 3. Funciona sin conexión

La primera visita descarga la app y la guarda. A partir de ahí:

- Abre y se usa **sin internet**, incluso en modo avión.
- Los datos viven en el dispositivo, así que no dependes de ningún servidor.
- Cuando hay una versión nueva, aparece un aviso con el botón **Actualizar**.
- La primera vez que queda lista sin conexión, la app lo dice: «Lista para usarse sin conexión».

### 4. Primeros pasos (5 minutos)

1. **Ajustes → Grupo**: pon el nombre y el sueldo base de cada persona. Añade tantas como
   necesites (una pareja, una familia, un piso compartido).
2. **Gastos → Nuevo gasto**: carga lo que se paga todos los meses — arriendo, servicios,
   supermercado, internet, Netflix. Cada gasto tiene monto, categoría, icono, día de vencimiento y
   forma de reparto.
3. **Mes**: revisa los sueldos del mes, ajusta montos si algo cambió, marca qué facturas ya salieron
   del fondo y confirma el aporte de cada persona.
4. **Ajustes → Metas**: define qué porcentaje del sueldo se aparta para cada meta (ahorro personal,
   vacaciones, aporte a los padres, caridad…). Cada meta puede ser **personal** (se sigue por
   persona) o **conjunta** (un solo fondo).

Al abrirla por primera vez trae **datos de ejemplo** con seis meses de historial para que veas cómo
funciona. En **Ajustes → Tus datos** puedes vaciarlos («Empezar de cero», con deshacer) o cargarlos
otra vez.

### 5. El día a día

- **Resumen** te dice el % del mes, cuánto le toca a cada uno, cómo va el fondo común y **qué hacer
  ahora** (los pasos pendientes por urgencia). Empieza por ahí.
- **Mes** es donde se trabaja: sueldos, montos, facturas pagadas y el aporte de cada persona al
  fondo.
- Los campos numéricos **se confirman al salir del campo** o con Enter, así el panel no recalcula
  mientras escribes. En **Metas del mes** cada meta lleva además un botón **✓** a su derecha para
  aplicar el cambio sin salir del campo: se enciende en cuanto escribes algo distinto. Si cambias de
  sección con algo a medio escribir, **se guarda igual**.
- Las metas del mes **arrancan vacías** hasta que registras lo apartado: el campo muestra un `0.00`
  gris de referencia y debajo, en pequeño, la meta que corresponde. Escribe lo que apartaste
  —aunque sea justo el importe de la meta— y pulsa **✓**; eso es lo que alimenta el acumulado del
  seguimiento. Si dejas el campo en `0`, el mes cuenta como **sin registrar**.
- Todo lo que borras se puede **deshacer** desde el aviso de abajo.
- Cada sección tiene su propia dirección (`#resumen`, `#mes`, `#gastos`, `#metas`, `#historial`,
  `#ajustes`), y los botones atrás/adelante del navegador funcionan.

### 6. Respaldar y mover los datos

Nada sale de tu dispositivo, así que **el respaldo es cosa tuya**:

- **Ajustes → Exportar JSON**: copia completa (grupo, gastos, meses y ajustes). Guárdala donde
  quieras.
- **Ajustes → Exportar CSV**: un libro mayor con una fila por gasto y mes, para abrirlo en Excel,
  Numbers o Google Sheets.
- **Ajustes → Importar JSON**: restaura un respaldo o pasa los datos a otro dispositivo.

> Los datos viven en el navegador. Si borras los datos del sitio, usas modo incógnito o cambias de
> equipo sin exportar, se pierden. Exporta de vez en cuando.

---

## Cómo se calcula

**El porcentaje.** Se suman los gastos compartidos del mes y se dividen por el ingreso combinado.
Ese porcentaje se aplica al sueldo de cada persona:

| | Sueldo | Aporte (48,82 %) | Le queda |
| --- | --- | --- | --- |
| Ana | 3.000 | **1.464,60** | 1.535,40 |
| Luis | 2.000 | **976,40** | 1.023,60 |
| **Total** | **5.000** | **2.441** | 2.559 |

El redondeo usa el **método del resto mayor**, así que la suma de los aportes coincide al céntimo
con el total de los gastos, incluso en casos como 100 ÷ 7.

**Fondo común, sin deudas.** Cada persona transfiere su porción a una cuenta común y desde ahí se
pagan las facturas. No hay «quién pagó qué» ni cálculos de quién le debe a quién: eso obliga a
resolver transferencias con montos desiguales y convierte un presupuesto en un registro de deudas.

**Metas.** Cada meta aparta un porcentaje del sueldo de cada persona. Para cada una verás:

- **Meta** — lo que se habría ahorrado aportando lo convenido todos los meses del año.
- **Acumulado** — la suma real, mes a mes.
- **Proyectado** — lo acumulado más lo que queda por guardar hasta diciembre.

**Modos de reparto por gasto.** *Proporcional* (por defecto, el mismo % para todos), *Partes
iguales* (sin mirar el sueldo) y *Montos fijos*. Si algún gasto no es proporcional, la app avisa de
que el % efectivo deja de ser igual para todos.

**Moneda.** Es agnóstica: por defecto solo muestra números. En Ajustes puedes poner símbolo (`$`,
`€`, `S/`), código ISO (`CLP`, `EUR`, `MXN`), decimales e idioma. Los importes se escriben y se leen
igual con `1.234,56` que con `1,234.56`.

---

## Preguntas frecuentes

**¿Necesito crear una cuenta?** No. No hay registro, ni servidor, ni analítica.

**¿Se sube algo a internet?** No. Todo se guarda en el almacenamiento del navegador y solo se mueve
si tú exportas e importas un archivo.

**¿Puedo usarla con más de dos personas?** Sí, la fórmula sirve para cualquier número de sueldos.
Funciona igual con tres o cuatro personas.

**¿Y si alguien no tiene sueldo este mes?** Déjalo en 0: los gastos proporcionales se reparten entre
quienes sí tienen ingreso, y la app avisa de que falta.

**¿Sirve si los gastos cambian cada mes?** Sí. El catálogo define los recurrentes; cada mes puedes
ajustar el monto, omitir un gasto o añadir uno puntual solo para ese mes.

**¿Cómo la desinstalo?** Desde el navegador o el sistema, como cualquier app. Antes, exporta tu
JSON si quieres conservar los datos.

---

## Para desarrollar

```bash
npm install
npm run dev        # desarrollo en http://localhost:5173
npm run build      # tipos + build de producción en dist/
npm run preview    # sirve el build (http://localhost:4173)
npm test           # 101 pruebas: motor, metas, fondo común, migración, reducer y UI
npm run typecheck  # solo verificación de tipos (estricta, sin 'any')
npm run lint       # oxlint
```

### Verificación

El proyecto trae sus propias herramientas de comprobación, además de las pruebas:

```bash
node scripts/cdp-audit.mjs      # consola, red, Lighthouse y medición de la página
node scripts/cdp-routes.mjs     # las 6 rutas × móvil y escritorio
node scripts/cdp-interact.mjs   # 11 interacciones con pulsaciones reales de ratón
node scripts/cdp-offline.mjs    # arranque y navegación sin conexión
node scripts/shot.mjs <url> <salida.png> 390 844   # capturas con emulación real de móvil
```

Estado actual: Lighthouse **100** en accesibilidad, buenas prácticas y SEO · 12/12 rutas sin
hallazgos · 11/11 interacciones · offline 8/8 · `tsc` y `oxlint` limpios. La integración continua
repite tipos, estilo, pruebas y build en cada push.

### Estructura

```
src/
  domain/          lógica pura, sin React (tipos, dinero, motor, metas, CSV, almacenamiento)
  state/           store con useReducer, avisos con deshacer y hooks de UI
  components/      primitivas BEM, controles propios, gráficos e iconos
  pages/           Resumen, Mes, Gastos, Metas, Historial, Ajustes
  styles.css       sistema visual completo (CSS puro, BEM)
scripts/           generación de iconos, auditorías y capturas
docs/              guía de estilo, análisis UX, rendimiento, iconos y bitácora de la interfaz
```

Los iconos (24, monocromos) se generaron con **gpt-image-2.5** en fal.ai y se recortaron con un
script propio; se pintan con `mask-image`, así que heredan el color del tema y de cada categoría.

### Documentación

- [Guía de estilo](docs/style-guide.md) — tokens, BEM, accesibilidad y cómo verificar.
- [Análisis UX y A/B testing](docs/ux-ab-testing.md) — qué se corrigió y qué experimentar.
- [Rendimiento medido](docs/perf.md) — LCP, CLS y por qué se descartó el troceado por ruta.
- [Iconos](docs/icon-prompts.md) — prompt, generación y recorte.
- [Bitácora de la interfaz](docs/ui-critique.md) — los fallos encontrados y su causa.

## Licencia

[Apache License 2.0](LICENSE) © 2026 Sergioluis Mendiola.
