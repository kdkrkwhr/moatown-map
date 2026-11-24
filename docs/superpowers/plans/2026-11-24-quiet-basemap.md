# Quiet Seoul basemap preview

1. Add a query switch with a test proving town/zone state and the existing default survive.
2. Mount local, noninteractive context in Leaflet panes below project geometry; render Korean district labels at overview scale. Toggle only background layers, not the map or camera.
3. Put the old detailed network stack behind deliberate user selection. Ensure delayed requests do not remount the old base after switching.
4. Verify static relative paths, attributed data, fallback, Seoul coordinate order, and unchanged project snapshots. Compare both views at one camera and on a small viewport before choosing the public default.
