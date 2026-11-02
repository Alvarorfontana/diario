# Catálogo inicial de conectores y fuentes

Estado: inventario y evaluación preliminar. Ningún conector está implementado ni autenticado.
Fecha de revisión: 2026-11-02.

## Criterios de clasificación

- Primaria: organismo o institución responsable del dato/documento.
- Secundaria: plataforma que agrega, procesa o analiza información de terceros.
- API pública: documentación o endpoint accesible sin credencial, sujeto a límites.
- API con credenciales: requiere registro, token o autorización.
- Captura asistida: consulta manual/RSS/descarga hasta verificar un endpoint estable.
- Antes de automatizar: verificar licencia, términos, cobertura, frecuencia, paginación, límites, campos, estabilidad y atribución.

## Fuentes argentinas — Política

| Fuente | Uso | Tipo/acceso | Prioridad |
|---|---|---|---|
| Dirección Nacional Electoral — https://resultados.mininterior.gob.ar/desarrollo | Resultados electorales históricos; API y CSV | Primaria; API documentada | Crítica |
| Cámara de Diputados — https://www.hcdn.gob.ar/proyectos/index.html | Proyectos legislativos | Primaria; consulta pública | Crítica |
| Plataforma de votaciones HCDN — https://votaciones.hcdn.gov.ar/ | Votaciones nominales y actas | Primaria; consulta/exportación pública | Crítica |
| Congreso de la Nación — https://www.congreso.gob.ar/ | Actividad institucional | Primaria; evaluar servicios disponibles | Alta |
| Argentina.gob.ar Normativa — https://www.argentina.gob.ar/normativa | Leyes, decretos y resoluciones | Primaria; buscador público | Crítica |
| Datos Argentina APIs — https://datos.gob.ar/es/apis | CKAN, Georef, series de tiempo y resultados electorales | Primaria; APIs documentadas | Alta |
| Data CP — https://www.datacp.ar/congreso | Votaciones, proyectos, discursos y actividad legislativa | Secundaria; API/exportaciones públicas para datasets documentados | Alta |
| Observatorio Legislativo — https://congreso.alexisdick.com/datos/ | Datos normalizados del período legislativo 2023–2028 | Secundaria; archivos abiertos, cotejar con fuente oficial | Media |

## Fuentes internacionales y de medios

| Fuente | Uso | Tipo/acceso | Prioridad |
|---|---|---|---|
| GDELT Project — https://www.gdeltproject.org/ | Monitoreo global de noticias y acontecimientos | Secundaria; verificar endpoints y límites vigentes | Alta |
| Media Cloud — https://www.mediacloud.org/documentation | Archivo, búsqueda y análisis de cobertura periodística | Secundaria; API documentada, comprobar acceso vigente | Alta |
| ACLED — https://acleddata.com/acled-api-documentation | Conflictos, protestas y violencia política | Secundaria; API requiere cuenta y autenticación | Alta |
| RSS de medios seleccionados | Cobertura local, nacional e internacional | Secundaria; habilitar fuente por fuente | Alta |

## Fuentes institucionales para el Observatorio

Mantener y ampliar el registro existente para:
- Boletín Oficial, INDEC, BCRA, Datos Argentina y ministerios nacionales.
- Gobierno de Brasil e IBGE.
- Reserva Federal, BLS y Congreso de Estados Unidos.
- Eurostat e instituciones de la Unión Europea.
- FAO, USDA y OMC.
- Organismos estadísticos, electorales y legislativos de los países priorizados.

## Reglas de conexión

1. No hacer scraping masivo por defecto. Preferir API oficial, descarga oficial o RSS autorizado.
2. Registrar la URL exacta de documentación, fecha de última prueba y responsable técnico.
3. Guardar la hora de consulta y el estado HTTP/resultado; nunca presentar una fuente caída como dato actualizado.
4. Mantener por separado fecha del acontecimiento, fecha de publicación y fecha de captura.
5. Conservar atribución y licencia; no almacenar texto completo de medios si las condiciones no lo permiten.
6. En encuestas, guardar consultora, fechas de campo, universo, muestra, método, margen de error y patrocinador cuando estén disponibles.
7. En datos parlamentarios, conservar identificador oficial de expediente, cámara, sesión, fecha, texto y acta de votación.
8. Las fuentes secundarias sirven para descubrimiento y análisis; las afirmaciones sensibles deben cotejarse con fuentes primarias.
9. Ninguna clave API se almacena en este repositorio. Usar gestor de secretos del entorno privado.

## Primer orden de implementación

1. DNE: resultados electorales y metadatos de elecciones.
2. HCDN: proyectos y votaciones; enlazar cada registro con el expediente/acta oficial.
3. Normativa y Boletín Oficial: seguimiento de actos del Ejecutivo.
4. Datos Argentina: indicadores y normalización territorial.
5. RSS curado + Media Cloud: radar de cobertura.
6. GDELT: descubrimiento de acontecimientos y actores.
7. ACLED: módulo especializado, luego de resolver alta y permisos de API.

## Referencias verificadas en la revisión inicial

- Datos Argentina APIs: https://datos.gob.ar/es/apis
- Resultados electorales DNE: https://resultados.mininterior.gob.ar/desarrollo
- Proyectos HCDN: https://www.hcdn.gob.ar/proyectos/index.html
- Votaciones HCDN: https://votaciones.hcdn.gov.ar/
- Normativa argentina: https://www.argentina.gob.ar/normativa
- Data CP Congreso: https://www.datacp.ar/congreso
- Media Cloud: https://www.mediacloud.org/documentation
- ACLED API: https://acleddata.com/acled-api-documentation
- GDELT: https://www.gdeltproject.org/

Este documento es un plan de integración, no evidencia de conectores activos.
