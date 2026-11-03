import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApp } from "../context/AppContext";
import Icon from "./Icon";

// Exp 3.2 - useRef reads the DOM box; Exp 5 - the map is now a real, interactive OpenStreetMap (Leaflet).
// Plots are stored with true latitude / longitude, so the weather and ET0 can be fetched for the exact spot.
// With onPick the map is clickable: a click (or the "use my location" button) reports { lat, lng }.
// Tiles come from OpenStreetMap; if the network is down the pins still show, on a blank background.
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';
const INDIA = [[8, 68], [35, 97]]; // the whole country, until the person has a plot or a pin to look at

const pinIcon = (state) =>
  L.divIcon({
    className: "map-pin-wrap",
    html: '<span class="material-symbols-outlined map-pin ' + state + '" aria-hidden="true">location_on</span>',
    iconSize: [40, 40],
    iconAnchor: [20, 38],
    tooltipAnchor: [0, -34],
  });

export default function PlotMap({ plots, marker, onPick, selectedId, height = 240, children }) {
  const { t } = useApp();
  const boxRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const [locateFailed, setLocateFailed] = useState(false);
  const centred = useRef(false); // an edit form centres the map on its pin once per map instance

  // create the map once; StrictMode runs this twice in development, so the cleanup must fully remove it
  useEffect(() => {
    centred.current = false; // a brand-new map has not been centred yet (the ref outlives a StrictMode remount)
    const map = L.map(boxRef.current, { zoomControl: true }).fitBounds(INDIA);
    L.tileLayer(TILES, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    const observer = new ResizeObserver(() => map.invalidateSize()); // the box can change size after the first render
    observer.observe(boxRef.current);
    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // a click on the map picks a location (only when the page asked for it)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPick) return undefined;
    const handler = (e) => onPick({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) });
    map.on("click", handler);
    return () => map.off("click", handler);
  }, [onPick]);

  // draw the pins again whenever the plots, the selection or the new pin change
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    plots.forEach((p) => {
      const name = document.createElement("span");
      name.textContent = p.name; // text, never HTML: a plot name is typed by a user
      L.marker([p.lat, p.lng], { icon: pinIcon(p.id === selectedId ? "selected" : ""), keyboard: false }).bindTooltip(name).addTo(layer);
    });
    if (marker) L.marker([marker.lat, marker.lng], { icon: pinIcon("new"), keyboard: false }).addTo(layer);
  }, [plots, selectedId, marker]);

  // frame the plots when the set of plots changes (not on every click while placing a pin)
  const framing = plots.map((p) => p.id + ":" + p.lat + "," + p.lng).join("|");
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !framing) return;
    map.fitBounds(L.latLngBounds(plots.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `framing` is the signature of `plots`
  }, [framing]);

  // an edit form opens on an existing pin and no plots: look at that pin once
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !marker || plots.length || centred.current) return;
    centred.current = true;
    map.setView([marker.lat, marker.lng], 15);
  }, [marker, plots.length]);

  const locate = () => {
    setLocateFailed(false);
    if (!navigator.geolocation) return setLocateFailed(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const spot = { lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) };
        onPick(spot);
        mapRef.current?.setView([spot.lat, spot.lng], 16);
      },
      () => setLocateFailed(true),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className={"map" + (onPick ? " pickable" : "")} style={{ height }}>
      <div ref={boxRef} className="map-canvas" role="application" aria-label={t("mapLabel")} />
      {children}
      {onPick && (
        <div className="map-locate">
          <button type="button" className="btn btn-sm" onClick={locate}>
            <Icon name="my_location" size={18} /> {t("useMyLocation")}
          </button>
          {locateFailed && <span className="label-sm error">{t("locateFailed")}</span>}
        </div>
      )}
    </div>
  );
}
