/**
 * folium maps are complete HTML pages. They run in a sandboxed frame without
 * access to the app (no same-origin), which also keeps shared journals safe.
 */
/** Libraries inside the map read localStorage, which the sandbox forbids; give them a harmless stand-in. */
const STORAGE_SHIM =
  '<script>try{window.localStorage}catch(e){var s={getItem:function(){return null},setItem:function(){},removeItem:function(){},clear:function(){}};Object.defineProperty(window,"localStorage",{value:s});Object.defineProperty(window,"sessionStorage",{value:s})}</script>'

export function HtmlOutput({ html, height = 440 }: { html: string; height?: number }) {
  const page = html.includes('<head>') ? html.replace('<head>', `<head>${STORAGE_SHIM}`) : STORAGE_SHIM + html
  return (
    <iframe
      title="map"
      srcDoc={page}
      sandbox="allow-scripts allow-popups"
      className="w-full rounded-xl bg-white ring-1 ring-ink-200"
      style={{ height }}
      loading="lazy"
    />
  )
}
