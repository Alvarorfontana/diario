# Decisiones pendientes antes del MVP

1. **Repositorio independiente:** crear un repositorio privado exclusivo para el Centro de Operaciones. La rama actual solo contiene protocolos documentales; no debe convertirse en el despliegue de producción del diario.
2. **Hosting:** proyecto Vercel independiente o infraestructura separada, sin alias ni dominio de diariofederal.com.ar.
3. **Persistencia:** seleccionar base de datos separada para señales, agenda, fuentes y auditoría.
4. **Acceso:** autenticación individual y permisos editor/colaborador/lector.
5. **Monitoreo:** acordar fuentes y frecuencia según disponibilidad real de RSS/API y condiciones de uso.
6. **Retención:** definir cuánto tiempo se conservan señales descartadas y expedientes.
7. **Publicación:** conexión futura desactivada por defecto; primero exportación de borradores.

Hasta resolver estos puntos, el sistema no ingiere automáticamente, no almacena credenciales y no publica.
