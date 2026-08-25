export type Lesson = {
  id: string
  title: string
  objective: string
  dataset: string
  focusAreas: string[]
  prompts: string[]
  starterXml: string
}

export const lessons: Lesson[] = [
  {
    id: 'neighbourhood-basics',
    title: 'Neighbourhood basics',
    objective:
      'Load a city neighbourhood layer, reproject it, and create a quick overview plot with GeoPandas.',
    dataset: 'data/neighbourhoods.geojson',
    focusAreas: ['GeoPandas I/O', 'CRS', 'Visualisation'],
    prompts: [
      'Start by loading the neighbourhood boundaries dataset.',
      'Reproject to a metric CRS before measuring or buffering.',
      'Finish by plotting the final layer to inspect the result.',
    ],
    starterXml: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="load_vector_data" x="24" y="24">
        <field name="PATH">data/neighbourhoods.geojson</field>
        <field name="VARIABLE">neighbourhoods</field>
        <next>
          <block type="reproject_layer">
            <field name="VARIABLE">neighbourhoods</field>
            <field name="EPSG">3857</field>
            <next>
              <block type="plot_layer">
                <field name="VARIABLE">neighbourhoods</field>
                <field name="TITLE">Neighbourhood overview</field>
              </block>
            </next>
          </block>
        </next>
      </block>
    </xml>`,
  },
  {
    id: 'flood-risk-screening',
    title: 'Flood risk screening',
    objective:
      'Prepare land parcels, build a buffer around rivers, and filter a working study area for a risk screening exercise.',
    dataset: 'data/parcels.geojson + data/rivers.geojson',
    focusAreas: ['Buffer analysis', 'Attribute filters', 'Study areas'],
    prompts: [
      'Load parcels and river centerlines as separate layers.',
      'Reproject the rivers into a metric CRS before creating a buffer.',
      'Create a river buffer to represent a simple flood influence zone after reprojecting.',
      'Filter the parcel table to inspect a single district or land use type.',
    ],
    starterXml: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="load_vector_data" x="24" y="24">
        <field name="PATH">data/parcels.geojson</field>
        <field name="VARIABLE">parcels</field>
        <next>
          <block type="load_vector_data">
            <field name="PATH">data/rivers.geojson</field>
            <field name="VARIABLE">rivers</field>
            <next>
              <block type="reproject_layer">
                <field name="VARIABLE">rivers</field>
                <field name="EPSG">3857</field>
                <next>
                  <block type="buffer_layer">
                    <field name="SOURCE">rivers</field>
                    <field name="OUTPUT">river_buffer</field>
                    <field name="DISTANCE">250</field>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </xml>`,
  },
  {
    id: 'service-access',
    title: 'Service access',
    objective:
      'Combine schools with neighbourhood polygons using a spatial join to explore access to public services.',
    dataset: 'data/schools.geojson + data/neighbourhoods.geojson',
    focusAreas: ['Spatial join', 'Tabular summaries', 'Maps for communication'],
    prompts: [
      'Load schools and neighbourhood layers.',
      'Use a spatial join to connect points with the polygons that contain them.',
      'Plot the joined result and inspect which neighbourhood each school belongs to.',
    ],
    starterXml: `<xml xmlns="https://developers.google.com/blockly/xml">
      <block type="load_vector_data" x="24" y="24">
        <field name="PATH">data/schools.geojson</field>
        <field name="VARIABLE">schools</field>
        <next>
          <block type="load_vector_data">
            <field name="PATH">data/neighbourhoods.geojson</field>
            <field name="VARIABLE">neighbourhoods</field>
            <next>
              <block type="spatial_join_layers">
                <field name="LEFT">schools</field>
                <field name="RIGHT">neighbourhoods</field>
                <field name="OUTPUT">schools_with_neighbourhoods</field>
                <next>
                  <block type="plot_layer">
                    <field name="VARIABLE">schools_with_neighbourhoods</field>
                    <field name="TITLE">Schools by neighbourhood</field>
                  </block>
                </next>
              </block>
            </next>
          </block>
        </next>
      </block>
    </xml>`,
  },
]
