export const de = {
  'language.label': 'Sprache',

  // Toolbox
  'toolbox.loadData': 'Daten laden',

  // load_huwise block
  'block.loadHuwise.dataset': 'lade Datensatz %1',
  'block.loadHuwise.portal': 'vom Portal %1',
  'block.loadHuwise.rows': 'höchstens %1 Zeilen',
  'block.loadHuwise.tooltip':
    'Lädt einen offenen Datensatz von einem Huwise-Portal (früher Opendatasoft). Du kannst auch den Link zur Datensatz-Seite einfügen.',

  // load_osem block and its setup window
  'block.loadOsem.title': 'lade openSenseMap-Daten %1',
  'block.loadOsem.phenomenon': 'Messgröße: %1',
  'block.loadOsem.place': 'Ort: %1',
  'block.loadOsem.period': 'Zeitraum: %1',
  'block.loadOsem.outdoorShort': 'nur draußen',
  'block.loadOsem.tooltip': 'Lädt Messwerte von senseBox-Stationen auf openSenseMap. Klick auf das Zahnrad, um Ort, Messgröße und Zeitraum zu wählen.',
  'osem.dialog.title': 'openSenseMap-Daten auswählen',
  'osem.dialog.description': 'Wähle, von welchen Stationen, welche Messgröße und für welchen Zeitraum du Messwerte laden möchtest.',
  'osem.dialog.stations': 'Welche Stationen?',
  'osem.dialog.byArea': 'In einem Gebiet',
  'osem.dialog.byTag': 'Aus einer Gruppe',
  'osem.dialog.area': 'Gebiet',
  'osem.dialog.tag': 'Gruppe',
  'osem.dialog.tagPlaceholder': 'Gruppe eingeben, z. B. Smart City MS',
  'osem.dialog.tagHint': 'Gruppen sind Schlagwörter, die die Besitzer:innen der Stationen vergeben, zum Beispiel für eine Schule oder ein Projekt.',
  'osem.dialog.enterTag':
    'Gib oben eine Gruppe ein oder wähle eine aus der Liste, zum Beispiel „Smart City MS“. Dann siehst du hier, was ihre Stationen messen.',
  'osem.dialog.period': 'Zeitraum',
  'osem.dialog.outdoorOnly': 'Nur Stationen im Freien',
  'osem.dialog.phenomenon': 'Was soll gemessen werden?',
  'osem.dialog.stationCount': '{count} Stationen',
  'osem.dialog.stationCountOne': '1 Station',
  'osem.dialog.searching': 'Suche Stationen …',
  'osem.dialog.noneActive': 'Hier hat im gewählten Zeitraum keine Station gemessen. Wähle ein anderes Gebiet, eine andere Gruppe oder einen längeren Zeitraum.',
  'osem.dialog.showAll': 'Alle {count} anzeigen',
  'osem.dialog.showFewer': 'Weniger anzeigen',
  'osem.dialog.pickPhenomenon': 'Wähle eine Messgröße aus.',
  'osem.dialog.cancel': 'Abbrechen',
  'osem.dialog.apply': 'Übernehmen',
  'dataset.loadingStations': 'Lade Stationen: {done} von {total}',
  'load.osemNoStations': 'Im gewählten Gebiet und Zeitraum hat keine Station diese Messgröße gemessen. Klick auf das Zahnrad und wähle etwas anderes.',
  'load.osemNoTag': 'Wähle eine Gruppe aus. Klick dazu auf das Zahnrad.',
  'load.osemUnknownArea': 'Dieses Gebiet gibt es nicht. Klick auf das Zahnrad und wähle ein Gebiet.',

  // Problems in how blocks are put together (shown on the block)
  'plan.needsData':
    'Dieser Block braucht Daten darüber. Häng ihn unter einen „lade Datensatz“-Block.',

  // Panel tabs
  'panel.data': 'Daten',
  'panel.python': 'Python',

  // Python tab
  'python.forDataset': 'Code für „{title}“.',
  'python.forSelected': 'Code für den ausgewählten Datenblock.',
  'python.forWorkspace': 'Code für alle Blöcke auf der Arbeitsfläche.',
  'python.variable': 'Im Code heißen diese Daten',
  'python.switchHint': 'Klick auf einen anderen Datenblock, um dessen Code zu sehen.',

  // Dataset panel
  'dataset.empty':
    'Zieh einen Block aus „Daten laden“ auf die Arbeitsfläche, um Daten zu sehen.',
  'dataset.loading': 'Lade Daten …',
  'dataset.loadingRows': 'Lade Zeilen: {done} von {total}',
  'dataset.rowsLoaded': '{loaded} von {total} Zeilen geladen',
  'dataset.rowsLoadedAll': '{loaded} Zeilen geladen',
  'dataset.partial':
    'Du siehst nur einen Teil des Datensatzes. Erhöhe „höchstens … Zeilen“ im Block, um mehr zu laden.',
  'dataset.source': 'Quelle',
  'dataset.license': 'Lizenz',
  'dataset.updated': 'Zuletzt aktualisiert',
  'dataset.collectedBy': 'Erhoben von',
  'dataset.openOnPortal': 'Auf dem Portal ansehen',
  'dataset.moreDescription': 'Mehr lesen',
  'dataset.lessDescription': 'Weniger',
  'dataset.columns': 'Spalten',
  'dataset.columnCount': '{count} Spalten',
  'dataset.preview': 'Erste Zeilen',
  'dataset.previewOf': 'die ersten {shown} von {loaded} Zeilen',

  'column.name': 'Spalte',
  'column.kind': 'Art',
  'column.filled': 'Ausgefüllt',
  'column.overview': 'Überblick',
  'column.missing': '{count} fehlen',
  'column.range': '{min} bis {max}',
  'column.mean': 'Mittelwert {mean}',
  'column.distinct': '{count} verschiedene Werte',
  'column.distinctOne': 'nur ein Wert',
  'column.timeRange': '{first} bis {last}',
  'column.empty': 'keine Werte',

  'semantic.measurement': 'Messwert',
  'semantic.category': 'Kategorie',
  'semantic.timestamp': 'Zeit',
  'semantic.latitude': 'Breitengrad',
  'semantic.longitude': 'Längengrad',
  'semantic.identifier': 'Kennung',
  'semantic.text': 'Text',

  // Load errors (shown on the block and in the panel)
  'load.invalidDomain':
    'Die Portal-Adresse sieht nicht richtig aus. Beispiel: hub.huwise.com',
  'load.invalidDataset':
    'Die Datensatz-ID sieht nicht richtig aus. Du findest sie in der Adresse der Datensatz-Seite, z. B. georef-germany-land.',
  'load.unreachable':
    'Das Portal ist nicht erreichbar. Prüfe die Adresse und die Internetverbindung.',
  'load.notFound': 'Diesen Datensatz gibt es auf dem Portal nicht. Prüfe die Datensatz-ID.',
  'load.notPublic': 'Dieser Datensatz ist nicht öffentlich.',
  'load.tooManyRequests': 'Das Portal bekommt gerade zu viele Anfragen. Warte kurz und versuch es noch einmal.',
  'load.noUsableFields': 'Dieser Datensatz hat keine Spalten, die SPOCKLY schon anzeigen kann.',
  'load.failed': 'Die Daten konnten nicht geladen werden. Versuch es noch einmal.',
}
