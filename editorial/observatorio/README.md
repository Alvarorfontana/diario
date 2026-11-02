# Observatorio de Noticias y Agenda Propia

Módulo prioritario del Centro de Operaciones Editoriales. Se desarrolla en esta rama y fuera del build público del diario.

## Propósito
Detectar acontecimientos, seguir fuentes, identificar cambios, descubrir asuntos subcubiertos y convertirlos en propuestas de cobertura propia. No es un agregador de titulares: debe producir preguntas periodísticas, hipótesis comprobables y oportunidades de investigación.

## Componentes
- `skills/news-observatory/SKILL.md`: monitoreo, detección y priorización.
- `skills/agenda-editorial/SKILL.md`: conversión de señales en propuestas de cobertura.
- `sources/registry.yml`: registro inicial de fuentes a monitorear y su evaluación.
- `schemas/agenda-item.schema.json`: contrato de datos de cada tema.
- `templates/daily-brief.md`: formato del informe diario.

## Áreas iniciales
1. Política y gestión pública argentina.
2. Congreso, justicia y organismos de control.
3. Provincias y gobiernos locales.
4. Brasil, Mercosur y América Latina.
5. Estados Unidos, Europa y geopolítica.
6. Economía, mercados, comercio exterior y energía.
7. Agroindustria, fertilizantes, alimentos y clima.
8. Trabajo, industria, infraestructura y tecnología.

## Ciclo operativo
Captura de señales → deduplicación → evaluación de relevancia → contraste de fuentes → propuesta de agenda → decisión editorial → investigación → publicación.

## Frecuencia inicial recomendada
- Barrido de actualidad: cada 2 horas, sujeto a conectores y cuotas disponibles.
- Informe de apertura: una vez por la mañana.
- Actualización de agenda: al mediodía y al cierre.
- Alertas urgentes: solo si hay novedad sustantiva y fuentes suficientes.

Estas frecuencias son configuración objetivo, no automatizaciones ya activas.

## Reglas de integridad
- Cada señal conserva fuente, URL, fecha de publicación y fecha del hecho cuando se conocen.
- Separar noticia original, republicación, opinión, comunicado y rumor.
- Agrupar coberturas del mismo acontecimiento sin borrar perspectivas diferentes.
- No inferir que una noticia es exclusiva o ignorada por otros medios sin comparar una muestra definida.
- La puntuación ordena la revisión; nunca determina por sí sola la publicación.
- Ningún elemento se publica automáticamente.
- Si una fuente no se puede consultar, registrar el fallo y no simular cobertura.

## Estado de implementación
Esta rama contiene la especificación editorial y los contratos iniciales. La ingesta automática, la persistencia y el panel web son etapas siguientes. No se despliega en diariofederal.com.ar.
