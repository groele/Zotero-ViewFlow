# The title of the pane element
zotero-preview-pane-title =
    .label = Zotero ViewFlow
    .tooltiptext = Zotero ViewFlow

######
# these are all in the Settings
zotero-preview-settings-heading = Ajustes de Zotero ViewFlow
zotero-preview-settings-intro = Adapte la vista previa de citas a su flujo de lectura y escritura.
zotero-preview-settings-title = Elegir estilo de vista previa
zotero-preview-card-content-heading = Estilo de cita y contenido de vista previa
zotero-preview-settings-style-heading = Estilo bibliográfico
zotero-preview-settings-style-description = Elija el estilo utilizado para dar formato a la vista previa. La opción Quick Copy utiliza el estilo actual de Zotero.

zotero-preview-card-layout-heading = Ubicación y tipografía
zotero-preview-settings-position = Posición de la vista previa
zotero-preview-settings-position-description = Elija dónde aparece la sección en el panel lateral de Zotero. También puede reordenarla desde el panel.
zotero-preview-settings-position-top =
    .label = Superior
zotero-preview-settings-position-afterinfo =
    .label = Después de la Info
zotero-preview-settings-position-bottom =
    .label = El pie

zotero-preview-settings-display = Contenido de la vista previa
zotero-preview-settings-display-description = Muestre la referencia con formato, la cita en el texto o ambas para cada elemento seleccionado.
zotero-preview-settings-whatToShow-both =
    .label = Ambos
zotero-preview-settings-whatToShow-bib =
    .label = Sólo bibliografía
zotero-preview-settings-whatToShow-intext =
    .label = Sólo citas en el texto

zotero-preview-settings-display-space = Texto y tamaño de vista previa
zotero-preview-settings-layout-description = Ajuste el tamaño y el espaciado del texto, y limite el número de elementos que aparecen.
zotero-preview-settings-display-fontsize = Tamaño de fuente relativo
zotero-preview-settings-display-linespacing = Espaciado entre líneas
zotero-preview-settings-display-max-items = Maximum items in preview

zotero-preview-card-advanced-heading = Opciones avanzadas y mantenimiento
zotero-preview-settings-debug-label =
    .label = Activar registro de depuración detallado
zotero-preview-settings-debug-description = Muestra información detallada de renderizado y caché en la consola de depuración de Zotero.
zotero-preview-settings-cache-heading = Gestión de la caché de vista previa
zotero-preview-settings-cache-description = Borra la caché de citas en memoria y vuelve a generar las vistas previas activas.
zotero-preview-settings-clear-cache-btn =
    .label = Borrar caché y actualizar
zotero-preview-settings-reset-heading = Restablecer valores predeterminados
zotero-preview-settings-reset-description = Restablece todas las preferencias de ViewFlow de este panel a sus valores predeterminados.
zotero-preview-settings-reset-btn =
    .label = Restablecer predeterminados
zotero-preview-select-items = Seleccione uno o varios elementos para previsualizar la cita.
zotero-preview-copy-unavailable = No se puede copiar. Pruebe los atajos de Zotero o vuelva a seleccionar el elemento.
zotero-preview-quickcopy-unavailable = El formato de Quick Copy no está disponible. Revise sus ajustes e inténtelo de nuevo.
zotero-preview-no-style = No hay ningún estilo bibliográfico seleccionado en Quick Copy. Elija un estilo en los ajustes de ZoteroPreview.
zotero-preview-unavailable = La vista previa no está disponible. Vuelva a seleccionar el elemento.

zotero-preview-loading = Cargando vista previa…
zotero-preview-native-position = La vista previa aparece en las barras laterales de la biblioteca y del lector. Arrastre su icono para cambiar el orden o use el menú contextual para fijar la sección.
zotero-preview-truncated = { $count } elementos adicionales omitidos.
zotero-preview-follow-quickcopy =
    .label = Seguir los ajustes de Quick Copy de Zotero
zotero-preview-copy-bibliography =
    .title = Copiar bibliografía
    .aria-label = Copiar bibliografía
zotero-preview-copy-citation =
    .title = Copiar cita en el texto
    .aria-label = Copiar cita en el texto

zotero-preview-style-missing = El estilo seleccionado no está instalado. Instálelo en Zotero o elija otro estilo en los ajustes de Zotero ViewFlow.
zotero-preview-retry = Volver a generar la vista previa
zotero-preview-settings-missing-style =
    .label = El estilo guardado no está instalado — elija otro
zotero-preview-version-badge = v{ $version }
zotero-preview-release-heading = Información de versión
zotero-preview-release-notes-label = Cambios
zotero-preview-release-notes = Se corrigieron la longitud en bytes y texto plano del portapapeles XPCOM, la recuperación de visibilidad y actualización de estilo, el renderizado progresivo de selecciones grandes, la visualización de errores CSL, los observadores de preferencias y la localización Fluent.
zotero-preview-release-date = Fecha de compilación
zotero-preview-release-date-value = { $date }
zotero-preview-release-download = Instalador
zotero-preview-release-download-link = Descargar el instalador ViewFlow { $version }
zotero-preview-release-repository = Repositorio
zotero-preview-release-repository-link = github.com/groele/Zotero-ViewFlow

zotero-preview-lookup-pane-title =
    .label = Zotero ViewFlow — Búsqueda inversa de citas
    .tooltiptext = Búsqueda Inversa de Citas

zotero-preview-card-lookup-heading = Búsqueda Inversa de Citas y Caché Local
zotero-preview-settings-lookup-enable-label =
    .label = Habilitar búsqueda inversa de citas compactas
zotero-preview-settings-lookup-enable-desc = Registra una sección dedicada en el panel lateral para localizar elementos desde citas compactas.
zotero-preview-settings-lookup-history-label =
    .label = Registrar historial de copia local para procedencia instantánea
zotero-preview-settings-lookup-history-desc = Guarda automáticamente las asignaciones al copiar para permitir la búsqueda inversa inmediata.
zotero-preview-settings-cache-dir-label = Ruta del archivo de caché local
zotero-preview-settings-cache-dir-desc = Edite la ruta completa o elija una carpeta. El nombre del archivo es viewflow-history.json.
zotero-preview-settings-cache-quota-label = Límite Máximo de Entradas de Caché (LRU)
zotero-preview-settings-cache-ttl-label = Retención de Caché TTL (Días)
zotero-preview-settings-cache-clear-label = Borrar caché de historial de citas local
zotero-preview-settings-cache-stats-desc = Borra los registros del historial de citas en caché del disco local y la memoria.

zotero-preview-lookup-input =
    .title = Admite citas compactas, DOI, arXiv con prefijo o enlace e historial de copia local. Enter para buscar; Esc para borrar.
    .placeholder = Pegue una referencia o DOI
    .aria-label = Referencia a buscar
zotero-preview-lookup-search = Buscar referencia
zotero-preview-lookup-clipboard = Leer portapapeles

zotero-preview-lookup-locate = Localizar elemento
zotero-preview-lookup-open-pdf = Abrir PDF

zotero-preview-cache-choose =
    .label = Elegir carpeta…

zotero-preview-cache-default =
    .label = Usar carpeta predeterminada

zotero-preview-cache-file-label = Archivo de caché actual (seleccione para copiar la ruta completa)

zotero-preview-cache-location-help = Only viewflow-history.json is used. Older files are not read or migrated. Enter the full file path or an absolute folder; leave blank for the default.

zotero-preview-cache-path-saved = Carpeta aplicada. El historial se guardará en la nueva ubicación en segundo plano.

zotero-preview-cache-path-failed = Carpeta no disponible. Introduzca una ruta absoluta con permiso de escritura o elija otra carpeta.
zotero-preview-cache-save-failed = Error al guardar el historial en disco. Los registros permanecen en memoria; pulse Reintentar.
zotero-preview-cache-retry =
    .label = Reintentar guardado de caché

zotero-preview-cache-usage = { $count } asignaciones de historial en caché / límite { $limit }

zotero-preview-cache-recommendation = Recomendado: 2.000 asignaciones y 90 días. Use 5.000 para consultas frecuentes o 10.000 para uso intensivo. Permitido: 100–100.000.

zotero-preview-cache-recommend =
    .label = Usar límites recomendados (2.000 / 90 días)

zotero-preview-lookup-scope = Admite citas compactas, DOI, arXiv con prefijo o enlace e historial de copia local. Enter para buscar; Esc para borrar.
zotero-preview-lookup-status-empty = Introduzca o pegue una cita
zotero-preview-lookup-status-searching = Buscando en la biblioteca local...
zotero-preview-lookup-status-located = Localizado
zotero-preview-lookup-status-locate-failed = Error al localizar, inténtelo de nuevo
zotero-preview-lookup-status-no-pdf = No se encontró ningún adjunto PDF
zotero-preview-lookup-status-unrecognized = Formato de cita no reconocido. Proporcione revista, año, volumen y páginas (o DOI/arXiv).
zotero-preview-lookup-status-not-found = No se encontraron coincidencias (Analizado: { $journal }, { $year })
zotero-preview-lookup-status-error = Error en la búsqueda. Vuelva a intentarlo.
zotero-preview-lookup-status-clipboard-fallback = No se puede leer el portapapeles directamente. Pegue manualmente (Ctrl+V).
zotero-preview-lookup-state-matched = Referencia coincidente
zotero-preview-lookup-state-located = Referencia localizada
zotero-preview-lookup-state-history = Coincidencia del historial de copia; verifique y localice
zotero-preview-lookup-state-candidate = Referencia candidata; verifique y localice
zotero-preview-lookup-candidates-heading = Se encontraron { $count } referencias posibles, haga clic para seleccionar:
zotero-preview-lookup-history-candidates = El historial coincide con { $count } referencias, haga clic para seleccionar:

zotero-preview-cache-clear-failed = Could not clear the cache file. Check permissions and retry; old history may remain on disk.
