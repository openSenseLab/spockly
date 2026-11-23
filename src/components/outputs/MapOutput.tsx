import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef } from 'react'

import { useLanguageStore, useT } from '../../i18n'
import type { Basemap, MapLayer } from '../../journal/types'
import { BASEMAPS, colorScale, sizeScale } from './mapLayers'
import { CATEGORICAL, formatNumber } from './palette'

type Props = {
  layers: MapLayer[]
  basemap?: Basemap
  height?: number
}

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

const MAX_LABELS = 300

const isPoint = (feature: GeoJSON.Feature) => feature.geometry?.type === 'Point' || feature.geometry?.type === 'MultiPoint'

export function MapOutput({ layers, basemap = 'light', height = 400 }: Props) {
  const t = useT()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const language = useLanguageStore((state) => state.language)

  // Uncoloured layers get their own categorical slot so layers stay distinguishable.
  const styled = useMemo(
    () =>
      layers.map((layer, index) => {
        const fallback = CATEGORICAL[index % CATEGORICAL.length]
        return { layer, fallback, ...colorScale(layer, fallback, language), size: sizeScale(layer) }
      }),
    [layers, language],
  )

  useEffect(() => {
    if (!hostRef.current) return
    const map = L.map(hostRef.current, { scrollWheelZoom: false })
    const baseLayers = Object.fromEntries(
      (Object.keys(BASEMAPS) as Basemap[]).map((key) => [
        t.maps.basemaps[key],
        L.tileLayer(BASEMAPS[key].url, { attribution: BASEMAPS[key].attribution, maxZoom: BASEMAPS[key].maxZoom }),
      ]),
    )
    baseLayers[t.maps.basemaps[basemap]].addTo(map)

    const overlays: Record<string, L.Layer> = {}
    const bounds = L.latLngBounds([])

    styled.forEach(({ layer, colorOf, fallback, size }, index) => {
      const color = (feature?: GeoJSON.Feature) => (layer.colorBy ? colorOf(feature?.properties?.[layer.colorBy]) : fallback)
      const asBubbles = layer.style === 'bubbles' || ((layer.style === 'auto' || layer.style === 'points') && !!size)
      const asPoints = layer.style === 'points' || asBubbles
      const labels = layer.label && layer.geojson.features.length <= MAX_LABELS ? layer.label : null

      const circle = (feature: GeoJSON.Feature, latlng: L.LatLng) =>
        L.circleMarker(latlng, {
          radius: size ? size.radius(feature.properties?.[layer.sizeBy!]) : asBubbles ? 9 : 6,
          weight: 1.5,
          color: '#ffffff',
          fillColor: color(feature),
          fillOpacity: asBubbles ? 0.55 : 0.9,
        })

      const group = L.featureGroup()
      const geo = L.geoJSON(layer.geojson, {
        pointToLayer: circle,
        style: (feature) =>
          layer.style === 'lines' || feature?.geometry?.type.includes('LineString')
            ? { color: color(feature), weight: 3, opacity: 0.9 }
            : { color: '#ffffff', weight: 1.5, fillColor: color(feature), fillOpacity: 0.6 },
        onEachFeature: (feature, featureLayer) => {
          const rows = Object.entries(feature.properties ?? {})
            .slice(0, 14)
            .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(formatNumber(value, language, key))}</td></tr>`)
            .join('')
          featureLayer.bindPopup(`<table class="map-popup">${rows}</table>`, { maxWidth: 320 })
          if (labels && feature.properties?.[labels] != null) {
            featureLayer.bindTooltip(escapeHtml(String(feature.properties[labels])), {
              permanent: true,
              direction: isPoint(feature) ? 'top' : 'center',
              className: isPoint(feature) ? 'map-label' : 'map-label map-label-area',
              offset: isPoint(feature) ? [0, -6] : [0, 0],
            })
          }
        },
      })

      if (asPoints) {
        // Areas or lines drawn as symbols: one circle at the centre of each feature.
        geo.eachLayer((featureLayer) => {
          const feature = (featureLayer as L.Layer & { feature?: GeoJSON.Feature }).feature
          if (!feature || isPoint(feature) || !('getBounds' in featureLayer)) {
            group.addLayer(featureLayer)
            return
          }
          const centre = circle(feature, (featureLayer as L.Polygon).getBounds().getCenter())
          const popup = featureLayer.getPopup()
          if (popup) centre.bindPopup(popup.getContent() as string)
          group.addLayer(centre)
        })
      } else {
        group.addLayer(geo)
      }

      group.addTo(map)
      overlays[layer.name || `${t.maps.layer} ${index + 1}`] = group
      const layerBounds = group.getBounds()
      if (layerBounds.isValid()) bounds.extend(layerBounds)
    })

    L.control.layers(baseLayers, overlays, { collapsed: true }).addTo(map)
    L.control.scale({ imperial: false }).addTo(map)
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    else map.setView([51.96, 7.63], 11)

    return () => void map.remove()
  }, [styled, basemap, language, t])

  const legends = styled.filter(({ legend, size }) => legend.length || size)

  return (
    <div>
      <div ref={hostRef} className="z-0 w-full overflow-hidden rounded-xl ring-1 ring-ink-200" style={{ height }} />
      {legends.length > 0 && (
        <div className="mt-3 space-y-2">
          {legends.map(({ layer, legend, size, fallback }, index) => (
            <div key={index} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-600">
              {layers.length > 1 && <span className="font-semibold text-ink-800">{layer.name || `${t.maps.layer} ${index + 1}`}:</span>}
              {legend.length > 0 && (
                <>
                  <span className="font-medium text-ink-700">{layer.colorBy}</span>
                  {legend.map((item, itemIndex) => (
                    <span key={itemIndex} className="inline-flex items-center gap-1.5">
                      <span className="size-3 rounded-sm ring-1 ring-black/5" style={{ background: item.color }} />
                      {item.label}
                    </span>
                  ))}
                </>
              )}
              {size && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="font-medium text-ink-700">{layer.sizeBy}</span>
                  <span className="size-2 rounded-full opacity-70" style={{ background: fallback }} />
                  {formatNumber(size.min, language)}
                  <span className="size-4 rounded-full opacity-70" style={{ background: fallback }} />
                  {formatNumber(size.max, language)}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
