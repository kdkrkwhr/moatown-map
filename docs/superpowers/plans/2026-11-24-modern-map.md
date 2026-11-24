# Modern map implementation plan

- Change the map background only: keep Leaflet for editable-free local overlays and attach OpenFreeMap Positron through the supported MapLibre bridge. Fall back to attributed OSM raster, then retain reference geometry and the list if raster fails.
- Group only visible representative pins at city zoom; zoom in on cluster selection and exclude the active pin from grouping.
- Open the native browse panel for deep links and map/list selections while leaving it dismissible. Preserve relative data URLs and stable IDs.
- Verify filtering, coordinate counts, clustering, deep links and Tile/WebGL fallback with automated checks where supported. Do not alter snapshots.
