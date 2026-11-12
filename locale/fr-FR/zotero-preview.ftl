# The title of the pane element
zotero-preview-pane-title =
    .label = Zotero ViewFlow
    .tooltiptext = Zotero ViewFlow

######
# these are all in the Settings
zotero-preview-settings-heading = Paramètres de Zotero ViewFlow
zotero-preview-settings-intro = Adaptez l’aperçu des citations à votre manière de lire et de rédiger.
zotero-preview-settings-title = Choisir le style d'aperçu
zotero-preview-card-content-heading = Style de citation et contenu de l’aperçu
zotero-preview-settings-style-heading = Style bibliographique
zotero-preview-settings-style-description = Choisissez le style utilisé pour formater l’aperçu. L’option Quick Copy reprend le style actuel de Zotero.

zotero-preview-card-layout-heading = Disposition et typographie
zotero-preview-settings-position = Position de l’aperçu
zotero-preview-settings-position-description = Choisissez l’emplacement de la section dans le panneau latéral de Zotero. Vous pouvez aussi la déplacer dans ce panneau.
zotero-preview-settings-position-top =
    .label = Première
zotero-preview-settings-position-afterinfo =
    .label = Après Info
zotero-preview-settings-position-bottom =
    .label = Bas

zotero-preview-settings-display = Contenu de l’aperçu
zotero-preview-settings-display-description = Affichez la référence formatée, la citation dans le texte ou les deux pour chaque élément sélectionné.
zotero-preview-settings-whatToShow-both =
    .label = Les deux
zotero-preview-settings-whatToShow-bib =
    .label = Bibliographie uniquement
zotero-preview-settings-whatToShow-intext =
    .label = Citation dans le texte uniquement

zotero-preview-settings-display-space = Texte et taille de l’aperçu
zotero-preview-settings-layout-description = Réglez la taille du texte et l’interligne, puis le nombre maximal d’éléments affichés.
zotero-preview-settings-display-fontsize = Taille de police relative
zotero-preview-settings-display-linespacing = Interligne
zotero-preview-settings-display-max-items = Maximum items in preview

zotero-preview-card-advanced-heading = Options avancées et maintenance
zotero-preview-settings-debug-label =
    .label = Activer la journalisation détaillée
zotero-preview-settings-debug-description = Affiche des messages détaillés de rendu et de diagnostic de cache dans la console de débogage de Zotero.
zotero-preview-settings-cache-heading = Gestion du cache d'aperçu
zotero-preview-settings-cache-description = Vider le cache des citations en mémoire et régénérer les aperçus actifs.
zotero-preview-settings-clear-cache-btn =
    .label = Vider le cache et actualiser
zotero-preview-settings-reset-heading = Rétablir les valeurs par défaut
zotero-preview-settings-reset-description = Réinitialise toutes les préférences ViewFlow de ce panneau à leurs valeurs par défaut.
zotero-preview-settings-reset-btn =
    .label = Rétablir par défaut
zotero-preview-select-items = Sélectionnez un ou plusieurs éléments pour prévisualiser la citation.
zotero-preview-copy-unavailable = Copie indisponible. Utilisez les raccourcis Zotero ou sélectionnez de nouveau l’élément.
zotero-preview-quickcopy-unavailable = Le format Quick Copy est indisponible. Vérifiez ses paramètres et réessayez.
zotero-preview-no-style = Aucun style bibliographique n’est sélectionné dans Quick Copy. Choisissez un style dans les paramètres de ZoteroPreview.
zotero-preview-unavailable = Aperçu indisponible. Sélectionnez de nouveau l’élément.

zotero-preview-loading = Chargement de l’aperçu…
zotero-preview-native-position = L’aperçu apparaît dans les barres latérales de la bibliothèque et du lecteur. Faites glisser son icône pour modifier l’ordre ou utilisez le menu contextuel pour épingler la section.
zotero-preview-truncated = { $count } éléments supplémentaires omis.
zotero-preview-follow-quickcopy =
    .label = Suivre les paramètres Quick Copy de Zotero
zotero-preview-copy-bibliography =
    .title = Copier la bibliographie
    .aria-label = Copier la bibliographie
zotero-preview-copy-citation =
    .title = Copier la citation dans le texte
    .aria-label = Copier la citation dans le texte

zotero-preview-style-missing = Le style sélectionné n’est pas installé. Installez-le dans Zotero ou choisissez un autre style dans Zotero ViewFlow.
zotero-preview-retry = Relancer l’aperçu
zotero-preview-settings-missing-style =
    .label = Le style enregistré n’est pas installé — choisissez-en un autre
zotero-preview-version-badge = v{ $version }
zotero-preview-release-heading = Version
zotero-preview-release-notes-label = Modifications
zotero-preview-release-notes = Correction de la longueur en octets et du texte brut du presse-papiers XPCOM, de la récupération d'affichage et de rafraîchissement de style, du rendu progressif des grandes sélections, de l'affichage des erreurs CSL, des observateurs de préférences et de la localisation Fluent.
zotero-preview-release-date = Date de compilation
zotero-preview-release-date-value = { $date }
zotero-preview-release-download = Installation
zotero-preview-release-download-link = Télécharger l'installation ViewFlow { $version }
zotero-preview-release-repository = Dépôt
zotero-preview-release-repository-link = github.com/groele/Zotero-ViewFlow

zotero-preview-lookup-pane-title =
    .label = Zotero ViewFlow — Recherche de citations
    .tooltiptext = Recherche Inverse de Citation

zotero-preview-card-lookup-heading = Recherche Inverse de Citation & Cache Local
zotero-preview-settings-lookup-enable-label =
    .label = Activer la recherche inverse de citations compactes
zotero-preview-settings-lookup-enable-desc = Enregistre une section dédiée dans le panneau latéral pour localiser des éléments à partir de citations compactes.
zotero-preview-settings-lookup-history-label =
    .label = Enregistrer l'historique des copies locales pour une provenance instantanée
zotero-preview-settings-lookup-history-desc = Enregistre automatiquement les correspondances lors de la copie pour une recherche inverse immédiate.
zotero-preview-settings-cache-dir-label = Chemin du fichier de cache local
zotero-preview-settings-cache-dir-desc = Modifiez le chemin complet ou choisissez un dossier. Le nom du fichier est viewflow-history.json.
zotero-preview-settings-cache-quota-label = Limite Maximale d'Entrées du Cache (LRU)
zotero-preview-settings-cache-ttl-label = Rétention du Cache TTL (Jours)
zotero-preview-settings-cache-clear-label = Vider le cache d'historique des citations locales
zotero-preview-settings-cache-stats-desc = Efface les enregistrements de l'historique des citations mis en cache du disque local et de la mémoire.

zotero-preview-lookup-input =
    .title = Prend en charge les références compactes, DOI, arXiv avec préfixe ou lien et l'historique de copie local. Entrée pour chercher ; Échap pour effacer.
    .placeholder = Collez une référence ou un DOI
    .aria-label = Référence à rechercher
zotero-preview-lookup-search = Rechercher la référence
zotero-preview-lookup-clipboard = Lire le presse-papiers

zotero-preview-lookup-locate = Localiser l'élément
zotero-preview-lookup-open-pdf = Ouvrir le PDF

zotero-preview-cache-choose =
    .label = Choisir un dossier…

zotero-preview-cache-default =
    .label = Utiliser le dossier par défaut

zotero-preview-cache-file-label = Fichier de cache actuel (sélectionnez pour copier le chemin complet)

zotero-preview-cache-location-help = Only viewflow-history.json is used. Older files are not read or migrated. Enter the full file path or an absolute folder; leave blank for the default.

zotero-preview-cache-path-saved = Dossier appliqué. L'historique sera enregistré au nouvel emplacement en arrière-plan.

zotero-preview-cache-path-failed = Dossier indisponible. Entrez un chemin absolu accessible en écriture ou choisissez un autre dossier.
zotero-preview-cache-save-failed = Échec de l'écriture du cache sur le disque. Les entrées restent en mémoire ; cliquez sur Réessayer.
zotero-preview-cache-retry =
    .label = Réessayer l'enregistrement du cache

zotero-preview-cache-usage = { $count } correspondances en cache / limite { $limit }

zotero-preview-cache-recommendation = Recommandé : 2 000 entrées et 90 jours. Utilisez 5 000 pour un usage fréquent ou 10 000 pour un usage intensif. Autorisé : 100–100 000.

zotero-preview-cache-recommend =
    .label = Utiliser les limites recommandées (2 000 / 90 jours)

zotero-preview-lookup-scope = Prend en charge les références compactes, DOI, arXiv avec préfixe ou lien et l'historique de copie local. Entrée pour chercher ; Échap pour effacer.
zotero-preview-lookup-status-empty = Veuillez saisir ou coller une citation
zotero-preview-lookup-status-searching = Recherche dans la bibliothèque locale...
zotero-preview-lookup-status-located = Localisé
zotero-preview-lookup-status-locate-failed = Échec de la localisation, veuillez réessayer
zotero-preview-lookup-status-no-pdf = Aucune pièce jointe PDF trouvée
zotero-preview-lookup-status-unrecognized = Format de citation non reconnu. Indiquez la revue, l'année, le volume et les pages (ou DOI/arXiv).
zotero-preview-lookup-status-not-found = Aucun élément correspondant trouvé (Analysé : { $journal }, { $year })
zotero-preview-lookup-status-error = Échec de la recherche. Veuillez réessayer.
zotero-preview-lookup-status-clipboard-fallback = Impossible de lire le presse-papiers directement. Collez manuellement (Ctrl+V).
zotero-preview-lookup-state-matched = Référence correspondante
zotero-preview-lookup-state-located = Référence localisée
zotero-preview-lookup-state-history = Correspondance de l'historique ; vérifiez et localisez
zotero-preview-lookup-state-candidate = Référence candidate ; vérifiez et localisez
zotero-preview-lookup-candidates-heading = { $count } références possibles trouvées, cliquez pour sélectionner :
zotero-preview-lookup-history-candidates = L'historique correspond à { $count } références, cliquez pour sélectionner :

zotero-preview-cache-clear-failed = Could not clear the cache file. Check permissions and retry; old history may remain on disk.
