# Arquitectura compartida — Diario Federal Intelligence

Estado: diseño técnico propuesto; no implementado ni conectado.
Fecha: 2026-11-02.

## Objetivo

Construir dos escritorios independientes sobre una infraestructura común de fuentes, ingesta, normalización y evidencia:

1. Editorial Intelligence: observatorio de medios, agenda editorial, investigación, verificación, redacción y briefings.
2. Political Intelligence: actores, instituciones, gobierno, Congreso, elecciones, relaciones de poder y política internacional.

No son dos nombres para la misma interfaz. Comparten servicios y registros, pero conservan permisos, navegación, flujos y espacios de trabajo diferenciados.

## Límites de seguridad

- No modificar el sitio público Diario Federal, su rama main, dominio, DNS, configuración Astro ni proyecto Vercel.
- No desplegar este sistema en el proyecto del sitio público.
- No guardar borradores, investigaciones internas, datos personales ni credenciales en el repositorio público.
- El repositorio de aplicación, la base de datos y el despliegue deberán ser privados e independientes.
- Ninguna fuente se considera conectada hasta implementar, probar y registrar una sincronización exitosa.
- Ninguna nota se publica automáticamente. La aprobación humana es obligatoria.

## Arquitectura lógica

Fuentes públicas e institucionales
→ conectores independientes
→ cola de ingesta y control de frecuencia
→ normalización y deduplicación
→ registro común de evidencias
→ clasificación temática, geográfica y de actores
→ APIs internas
→ dos interfaces diferenciadas.

## Servicios compartidos

- Source Registry: catálogo de fuentes, tipo, jurisdicción, cobertura, licencia, método de acceso, autenticación y estado.
- Ingestion Jobs: ejecución programada, límites, reintentos y registro de errores.
- Normalizer: normalización de fechas, idiomas, entidades, jurisdicciones y URLs canónicas.
- Deduplication: detección de notas repetidas y agrupación de cobertura sobre un mismo acontecimiento.
- Evidence Store: URL original, título, autor/institución, fecha de publicación, fecha de captura, extracto permitido, documento, hash, fuente y estado de verificación.
- Entity Registry: personas, organismos, partidos, empresas, países, territorios y relaciones documentadas.
- Audit Log: quién creó, corrigió, verificó, aprobó o descartó un registro.
- Search API: búsqueda común con filtros y permisos.

## Aplicación A — Editorial Intelligence

Módulos:
1. Panel editorial.
2. Observatorio de medios y acontecimientos.
3. Agenda propia y calendario de coberturas.
4. Expedientes de investigación.
5. Verificación y matriz de afirmaciones.
6. Redacción y edición.
7. Aprobación editorial.
8. Informe diario y exportación.

Flujo: señal → evaluación → agenda → expediente → verificación → redacción → edición → aprobación humana → exportación o publicación controlada.

## Aplicación B — Political Intelligence

Módulos:
1. Panel estratégico.
2. Actores e instituciones.
3. Relaciones y mapa de poder.
4. Gobierno y gestión.
5. Congreso y legislación.
6. Elecciones, encuestas y resultados.
7. Política internacional.
8. Análisis e hipótesis.
9. Informe político diario.

Toda relación de poder debe tener evidencia, fuente, fecha y nivel de confianza. Una inferencia analítica nunca debe mostrarse como hecho confirmado.

## Esquema común mínimo

- sources: fuente, jurisdicción, tipo, método, licencia, estado.
- documents: documento o publicación original y metadatos.
- events: acontecimiento con tiempo, lugar, categoría y evidencias.
- entities: personas e instituciones con identificadores y vigencia.
- relationships: relación entre entidades, tipo, período y evidencias.
- claims: afirmaciones verificables, estado y evidencias favorables/contrarias.
- topics: etiquetas y taxonomía editorial.
- agenda_items: propuestas y coberturas.
- investigations: expedientes y preguntas de investigación.
- audit_log: historial de acciones.

## Diseño visual

Lenguaje compartido: grafito, azul petróleo, blanco cálido y acento ámbar; tipografía legible; navegación lateral; jerarquía editorial; gráficos con escala, período y fuente visibles.

Editorial Intelligence prioriza lectura, comparación de cobertura, agenda y flujo de trabajo. Political Intelligence prioriza cronologías, redes de actores, composición institucional, votaciones y mapas.

Los indicadores deben mostrar período, universo, metodología y fuente. Si falta información, mostrar “sin datos” y no cero. Los prototipos deben etiquetar claramente cualquier dato ilustrativo como DEMO.

## Fases de implementación

0. Aprobación del alcance, repositorio privado y decisión de infraestructura.
1. MVP común: autenticación, permisos, registro de fuentes, captura manual, evidencia, búsqueda y auditoría.
2. Editorial MVP: observatorio, agenda y verificación.
3. Political MVP: actores, Congreso, normativa y resultados electorales.
4. Conectores automáticos, alertas y briefings programados.
5. Analítica comparada, relaciones y mapas avanzados.

## Criterios de aceptación

- Cada dato muestra procedencia y fecha.
- Se distingue publicación original de republicación.
- Se conserva historial de modificaciones.
- Los fallos de sincronización son visibles.
- No se filtra una fuente no verificada como hecho.
- No se expone ninguna credencial en el cliente.
- No existe ruta de publicación automática.
- La aplicación no comparte infraestructura de despliegue con el sitio público.
