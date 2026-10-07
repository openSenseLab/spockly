import type { de } from './de'

export const en: Record<keyof typeof de, string> = {
  'language.label': 'Language',

  // Toolbox
  'toolbox.loadData': 'Load data',

  // load_huwise block
  'block.loadHuwise.dataset': 'load dataset %1',
  'block.loadHuwise.portal': 'from portal %1',
  'block.loadHuwise.rows': 'at most %1 rows',
  'block.loadHuwise.tooltip':
    'Loads an open dataset from a Huwise portal (formerly Opendatasoft). You can also paste the link of the dataset page.',

  // load_osem block and its setup window
  'block.loadOsem.title': 'load openSenseMap data %1',
  'block.loadOsem.phenomenon': 'measuring: %1',
  'block.loadOsem.place': 'place: %1',
  'block.loadOsem.period': 'period: %1',
  'block.loadOsem.outdoorShort': 'outdoor only',
  'block.loadOsem.tooltip': 'Loads measurements from senseBox stations on openSenseMap. Click the gear to choose place, what is measured and the period.',
  'osem.dialog.title': 'Choose openSenseMap data',
  'osem.dialog.description': 'Choose which stations, what is measured and the period you want to load measurements for.',
  'osem.dialog.stations': 'Which stations?',
  'osem.dialog.byArea': 'In an area',
  'osem.dialog.byTag': 'From a group',
  'osem.dialog.area': 'Area',
  'osem.dialog.tag': 'Group',
  'osem.dialog.tagPlaceholder': 'Type a group, e.g. Smart City MS',
  'osem.dialog.tagHint': 'Groups are tags that station owners give their stations, for example for a school or a project.',
  'osem.dialog.enterTag':
    'Type a group above or pick one from the list, for example “Smart City MS”. Then you’ll see here what its stations measure.',
  'osem.dialog.period': 'Period',
  'osem.dialog.outdoorOnly': 'Outdoor stations only',
  'osem.dialog.phenomenon': 'What should be measured?',
  'osem.dialog.stationCount': '{count} stations',
  'osem.dialog.stationCountOne': '1 station',
  'osem.dialog.searching': 'Looking for stations …',
  'osem.dialog.noneActive': 'No station measured anything here in this period. Choose a different area, a different group or a longer period.',
  'osem.dialog.showAll': 'Show all {count}',
  'osem.dialog.showFewer': 'Show fewer',
  'osem.dialog.pickPhenomenon': 'Choose what should be measured.',
  'osem.dialog.cancel': 'Cancel',
  'osem.dialog.apply': 'Apply',
  'dataset.loadingStations': 'Loading stations: {done} of {total}',
  'load.osemNoStations': 'No station measured this in the chosen area and period. Click the gear and choose something else.',
  'load.osemNoTag': 'Choose a group. Click the gear to do so.',
  'load.osemUnknownArea': 'This area doesn’t exist. Click the gear and choose an area.',

  // Problems in how blocks are put together (shown on the block)
  'plan.needsData': 'This block needs data above it. Attach it below a “load dataset” block.',

  // Panel tabs
  'panel.data': 'Data',
  'panel.python': 'Python',

  // Python tab
  'python.forDataset': 'Code for “{title}”.',
  'python.forSelected': 'Code for the selected data block.',
  'python.forWorkspace': 'Code for all blocks on the workspace.',
  'python.variable': 'In the code, this data is called',
  'python.switchHint': 'Click another data block to see its code.',

  // Dataset panel
  'dataset.empty': 'Drag a block from “Load data” onto the workspace to see data.',
  'dataset.loading': 'Loading data …',
  'dataset.loadingRows': 'Loading rows: {done} of {total}',
  'dataset.rowsLoaded': '{loaded} of {total} rows loaded',
  'dataset.rowsLoadedAll': '{loaded} rows loaded',
  'dataset.partial':
    'You are only seeing part of the dataset. Increase “at most … rows” in the block to load more.',
  'dataset.source': 'Source',
  'dataset.license': 'Licence',
  'dataset.updated': 'Last updated',
  'dataset.collectedBy': 'Collected by',
  'dataset.openOnPortal': 'View on the portal',
  'dataset.moreDescription': 'Read more',
  'dataset.lessDescription': 'Less',
  'dataset.columns': 'Columns',
  'dataset.columnCount': '{count} columns',
  'dataset.preview': 'First rows',
  'dataset.previewOf': 'the first {shown} of {loaded} rows',

  'column.name': 'Column',
  'column.kind': 'Kind',
  'column.filled': 'Filled in',
  'column.overview': 'Overview',
  'column.missing': '{count} missing',
  'column.range': '{min} to {max}',
  'column.mean': 'average {mean}',
  'column.distinct': '{count} different values',
  'column.distinctOne': 'only one value',
  'column.timeRange': '{first} to {last}',
  'column.empty': 'no values',

  'semantic.measurement': 'Measurement',
  'semantic.category': 'Category',
  'semantic.timestamp': 'Time',
  'semantic.latitude': 'Latitude',
  'semantic.longitude': 'Longitude',
  'semantic.identifier': 'Identifier',
  'semantic.text': 'Text',

  // Load errors (shown on the block and in the panel)
  'load.invalidDomain': 'The portal address doesn’t look right. Example: hub.huwise.com',
  'load.invalidDataset':
    'The dataset ID doesn’t look right. You’ll find it in the address of the dataset page, e.g. georef-germany-land.',
  'load.unreachable': 'The portal can’t be reached. Check the address and the internet connection.',
  'load.notFound': 'This dataset doesn’t exist on the portal. Check the dataset ID.',
  'load.notPublic': 'This dataset isn’t public.',
  'load.tooManyRequests': 'The portal is getting too many requests right now. Wait a moment and try again.',
  'load.noUsableFields': 'This dataset has no columns SPOCKLY can show yet.',
  'load.failed': 'The data couldn’t be loaded. Please try again.',
}
