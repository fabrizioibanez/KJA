# Reportes de Facebook

## Activación

1. Si ya se aplicó la migración 64, ejecutar `supabase/dashboard_65_reporte_facebook_hoy.sql`. Para instalaciones nuevas, aplicar 64 y después 65.
2. Publicar `dashboard.html` y los JS/CSS actualizados, incluidos `assets/js/facebook-report-excel-layout.js`, `assets/js/facebook-report-excel.js`, `assets/js/facebook-report-pdf.js` y `assets/js/vendor/`. Descargar un archivo nuevo; los anteriores no cambian.
3. Con una cuenta de Dirección, abrir Gestión de asistencia → Reportes Facebook.

Ambas migraciones contienen la función actualizada. La 65 permite actualizar instalaciones que ya ejecutaron la versión inicial de la 64. Solo cambian un RPC de lectura, sin modificar evidencias ni requerir cambios de Edge Functions. No se aplicaron al entorno remoto en esta sesión.

## Selección del corte

- Lunes 14/09/2026: jueves 10, viernes 11, sábado 12 y domingo 13.
- Jueves 17/09/2026: lunes 14, martes 15 y miércoles 16. Se puede consultar desde el miércoles 16, incluyendo lo registrado ese día.
- Se permite elegir una fecha de reporte hasta mañana; las fechas de actividad nunca pueden superar hoy en Lima. Por defecto se selecciona el corte más reciente disponible contando mañana.
- Al cambiar entre lunes y jueves se selecciona el corte más reciente de ese tipo. Para consultar uno anterior se usan las flechas ‹ › o el calendario. Una fecha de otro día se ajusta al lunes o jueves anterior y la pantalla muestra la fecha efectiva.
- General del mes («Mes»): desde el día 1 hasta fin de mes, o hasta hoy si es el mes actual. Las flechas pasan de un mes a otro.
- Personalizado: un solo calendario con atajos (últimos 7, 14, 21 o 90 días y mes anterior) y botón Aplicar; hasta 93 días, como máximo hasta hoy.

Si se incluye hoy o hay franjas pendientes, se indica **Provisional** en pantalla y Excel. Los «No» de franjas abiertas pueden cambiar y se ven como «En plazo», aunque siguen contando como No. El reporte se consulta solo al abrir la sección y al cambiar el corte, la fecha o el rango; no se envía a nadie.

## Pantalla

- **Cabecera:** período exacto, estado (cerrado o provisional), hora de actualización, «Cómo se calcula» con los criterios y un único botón «Descargar» con Excel y PDF completo. Al desplazarse queda una barra compacta con período, área y cumplimiento.
- **Indicadores:** anillo de cumplimiento con la meta del 80 %, nivel y diferencia contra el período anterior (corte anterior del mismo tipo, mes anterior o rango de igual duración). Esa comparación es una segunda consulta al mismo RPC después de mostrar el reporte; si falla, no se muestra. Cuatro tarjetas: Sí, No, colaboradores y días que no aplican.
- **Cumplimiento por día:** barras por fecha con la meta y una nota del día o fin de semana más bajo. En meses y rangos de más de 10 días se ven barras finas con los fines de semana marcados.
- **Requieren atención:** hasta 6 personas con 2 o más días sin evidencia (o con 1, si nadie tiene 2) y un acceso a la vista por persona filtrada.
- **Vista por persona:** búsqueda por nombre o área, filtros con conteo (Todos, Con algún No, Completo, Sin evaluar), orden por defecto de menor a mayor cumplimiento y totales del grupo visible. En meses y rangos largos usa un mapa de calor con ✓/✕ en cada día.
- **Evidencia:** al hacer clic en un Sí o un No se abre un panel lateral con el mismo detalle de evidencias que el modal anterior (`KJAMonthDayDetail`, solo Facebook). La tabla sigue visible y la celda queda marcada. Las flechas del teclado cambian de día (← →) o de persona (↑ ↓) y Esc cierra.
- Colores de la gama del panel administrativo (crema, durazno y óxido); verde, ámbar y rojo solo indican el resultado. Mientras se ve el reporte, «Actualizar» usa el óxido del panel y el botón de Mensajes queda como círculo.

## Tabla por área

Una fila por área con personas, Sí, No, evaluados, cumplimiento con barra (marca de meta en 80 %) y nivel. Se ordena por cualquier columna; por defecto, de mayor a menor cumplimiento. Las áreas bajo 50 % llevan un borde rojo. Al hacer clic en un área se despliega en su propia fila el detalle diario: una fila por colaborador, una columna por fecha, su Sí, No y cumplimiento, y al pie los totales diarios Sí / No. Si se filtra una sola área, su detalle se abre solo.

- **Sí:** la última entrega de Facebook está completa y tiene al menos una imagen registrada. Incluye evidencias pendientes de revisión u observadas.
- **No:** no existe esa evidencia al consultar, incluso si aún queda plazo. No demuestra que la persona no haya compartido fuera del sistema.
- **No comparte ese día:** no tiene Facebook asignado en su agenda; no se atribuye al contrato porque el reporte no confirma ese motivo.
- **Sistema aún no activo / Aún no incorporado / Falta fecha de ingreso:** se muestra la causa concreta de exclusión.
- **Sin información:** falta el registro en el resultado. Ninguno de estos motivos suma al total evaluado.

No se muestran cantidades de capturas, revisiones ni identificadores en el reporte o Excel. Una entrega con muchas imágenes o un collage sigue contando como un solo Sí por persona/día. Los nombres y áreas se leen de la base, sin listas fijas.

## Alcance de los datos

Se usa la última versión de la entrega `comparticiones`, sin asignación. Una entrega anulada o sin imágenes no recupera versiones anteriores como evidencia. La agenda de Facebook es independiente de asistencia y días de trabajo. La habilitación actual de las cargas no invalida el histórico.

El comienzo del sistema se lee de `asis_cierre_config.obligatorio_desde` (valor inicial: 2026-09-07). Se usa el equipo activo, sus áreas y horarios actuales. Las bajas, cambios de agenda o de fechas de ingreso/activación pueden alterar resultados históricos; no es una instantánea inmutable de la plantilla pasada.

## Excel

La descarga es un archivo `.xlsx` real, generado localmente en el navegador, sin servicios externos. Reemplaza el CSV que Excel podía abrir en una sola columna según su configuración regional. Respeta el filtro de área y crea solo dos pestañas: **Resumen** y **Detalle**. Se conservan período, actualización en hora de Lima, estado provisional y leyenda.

Resumen presenta indicadores de personas y registros persona/día, comparación por área y porcentaje de registro con barras. Sus cifras se vinculan por fórmulas al Detalle, que reúne a todos los equipos en bloques continuos. Incluye fechas numéricas con formato de fecha, nombres como texto seguro, filas alternadas, ajuste de texto, verde para Sí y rojo para No mediante formato condicional. Los totales usan COUNTIF y SUM con resultados almacenados y recálculo al abrir. Se ocultan cuadrícula y encabezados de filas/columnas, se agrega margen blanco y se elimina la división vertical de paneles sobre el título. El Detalle conserva cinco filas fijas al desplazarse. Incluye áreas de impresión delimitadas, encabezados repetidos y filtro por área en el Resumen.

Este cambio de etiquetas y exportación no requiere nuevas migraciones SQL.

## PDF completo y ranking

«Descargar PDF completo» descarga directamente un PDF A4 horizontal, sin diálogo de impresión. Contiene el Detalle de **todas** las áreas del período consultado, aunque la vista esté filtrada a una sola área. El botón y su ayuda indican este alcance. El Excel conserva su comportamiento anterior y respeta el filtro.

Las matrices muestran nombres, fechas, Sí/No y los motivos de exclusión, con totales diarios y colores. Para intervalos largos se distribuyen las fechas en bloques de hasta siete días, repitiendo nombres y encabezados. Cada página identifica el período, momento de consulta en Lima, estado provisional y número de página.

Al final se agrega un ranking por **total de Sí de cada área**, de mayor a menor. Cada Sí es una persona con evidencia en una fecha, no un número de capturas ni un conteo verificable de publicaciones externas. Los empates comparten puesto (1, 1, 3); se ordenan alfabéticamente dentro del empate. Áreas sin días evaluados aparecen al final con «Sin evaluación». No se ordena por porcentaje ni se ajusta por tamaño del área. La última fila suma personas y total de Sí.

La generación ocurre localmente con [jsPDF](https://github.com/parallax/jsPDF) y [AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable), versiones fijadas y licencias incluidas en `assets/js/vendor/`. Los archivos solo se cargan al solicitar un PDF. No se transmite información a terceros. Cambiar el período durante la carga cancela esa descarga; un error permite reintentar.

## Verificación

`node --test tests/facebook-report.test.mjs tests/facebook-pdf.test.mjs`: 21 pruebas. Además de cortes, matrices, filtros y permisos, verifican XLSX, fórmulas entre hojas, descarga PDF de todas las áreas, errores y consultas desactualizadas, ranking con empates, exclusiones y límites de las celdas en tablas largas. La revisión de PDF usó las bibliotecas reales: un corte ficticio de 3 páginas y un mensual ficticio de 37 páginas se renderizaron y validaron con PyMuPDF. Se inspeccionaron visualmente el corte completo y páginas representativas del mensual; se comprobaron automáticamente textos y límites de todas las páginas. Se corrigió un salto inicial que producía una página vacía en reportes grandes.

No se verificó visualmente el archivo en Excel: se intentó conectar el control de aplicaciones, pero su servicio nativo no estaba disponible. La herramienta de artefactos de hojas de cálculo tampoco estaba disponible; las comprobaciones cubren el código de exportación y su estructura, no la apariencia renderizada.

Tras integrar el comunicado remoto, pasan las 186 pruebas de la suite. Se corrigió una condición de carrera preexistente en la prueba de progreso de eliminación: ahora espera al inicio de la solicitud simulada antes de verificar los controles, en lugar de asumir que dos microtareas bastan. No se cambió el comportamiento de eliminación del portal.

Pendiente: ejecutar el SQL en Supabase y contrastar con datos reales. No se realizó verificación visual en navegador; no había navegador conectado en la sesión.

### Rediseño de la pantalla (noviembre 2026)

Solo cambia la interfaz: `dashboard.html`, `assets/css/paginas/dashboard-facebook-report.css` (reemplaza también a `dashboard-facebook-studio.css` y a las reglas de Facebook de `dashboard-operations.css`) y `assets/js/dashboard-facebook-report.js`. No requiere SQL ni cambios en Supabase; el Excel y el PDF se generan igual. `tests/facebook-report.test.mjs` tiene 25 pruebas; se adaptaron las que comprobaban los acordeones en dos columnas y la ilustración previa a la consulta.

Se revisó en Chrome con una página local que carga la sección real con datos de ejemplo (39 personas, 9 áreas) y un RPC simulado, a 1440, 1680 y 1920 px: corte, detalle por área, vista por persona, mes con mapa de calor, rango personalizado, provisional, error, menús y panel de evidencia, además de clics y teclado. Falta revisarlo con una cuenta de Dirección y datos reales.
