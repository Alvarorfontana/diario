import { config, collection, fields } from '@keystatic/core';

export default config({
  storage: {
    kind: 'github',
    repo: 'Alvarorfontana/el-diario',
  },
  collections: {
    articulos: collection({
      label: 'Artículos',
      slugField: 'slug',
      path: 'src/content/articulos/*',
      format: { contentField: 'content' },
      schema: {
        title: fields.text({
          label: 'Título',
          validation: { isRequired: true },
        }),
        slug: fields.slug({
          name: {
            label: 'Slug',
            description: 'Se genera automáticamente a partir del título y solo usa texto seguro para la URL.',
          },
          from: { field: 'title' },
          validation: { isRequired: true },
        }),
        description: fields.text({
          label: 'Resumen',
          multiline: true,
          validation: { isRequired: true },
        }),
        section: fields.select({
          label: 'Sección',
          description: 'Sección del periódico',
          defaultValue: 'internacional',
          options: [
            { label: 'Internacional', value: 'internacional' },
            { label: 'Argentina', value: 'argentina' },
            { label: 'Economía', value: 'economia' },
            { label: 'Deportes', value: 'deportes' },
            { label: 'Cultura', value: 'cultura' },
            { label: 'Tecnología', value: 'tecnologia' },
            { label: 'Opinión', value: 'opinion' },
          ],
          validation: { isRequired: true },
        }),
        author: fields.text({
          label: 'Autor',
          defaultValue: 'Redacción',
        }),
        pubDate: fields.date({
          label: 'Fecha de publicación',
          validation: { isRequired: true },
        }),
        updatedDate: fields.date({
          label: 'Fecha de actualización',
          description: 'Opcional',
        }),
        heroImage: fields.image({
          label: 'Imagen principal',
          description: 'Archivo opcional para la cabecera del artículo',
        }),
        imageCaption: fields.text({
          label: 'Epígrafe de la imagen',
          multiline: true,
        }),
        ultimoMomento: fields.checkbox({
          label: 'Último momento',
          description: 'Marca la noticia como alerta en la portada',
        }),
        tags: fields.array(
          fields.text({ label: 'Etiqueta' }),
          {
            label: 'Etiquetas',
            itemLabel: (value) => value ?? 'Etiqueta',
          }
        ),
        content: fields.markdoc({
          label: 'Contenido',
          description: 'Escribe el contenido de la nota.',
          extension: 'md',
        }),
      },
    }),
  },
});
