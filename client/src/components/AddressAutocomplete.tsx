/// <reference types="@types/google.maps" />

/**
 * AddressAutocomplete
 * A drop-in replacement for a plain address <Input> that shows Google Maps
 * Places suggestions as the user types. When a suggestion is selected the
 * component parses the address components and calls onPlaceSelect with
 * structured fields so callers can auto-fill street, city, state and zip.
 *
 * Usage:
 *   <AddressAutocomplete
 *     value={form.address}
 *     onChange={(v) => setForm({ ...form, address: v })}
 *     onPlaceSelect={({ street, city, state, zip, formatted }) => {
 *       setForm({ address: street, city, state, zip });
 *     }}
 *     placeholder="Start typing an address…"
 *   />
 */

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin, Loader2 } from "lucide-react";

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

let scriptLoadPromise: Promise<void> | null = null;

function loadMapsScript(): Promise<void> {
  // Already fully loaded
  if (window.google?.maps?.places) return Promise.resolve();
  // Already in progress
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=places,geocoding`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      // Poll until google.maps.places is actually ready (async loading quirk)
      const poll = (attempts = 0) => {
        if (window.google?.maps?.places) {
          resolve();
        } else if (attempts < 20) {
          setTimeout(() => poll(attempts + 1), 150);
        } else {
          reject(new Error("Google Maps places library not available after load"));
        }
      };
      poll();
    };
    script.onerror = () => {
      scriptLoadPromise = null; // Allow retry
      reject(new Error("Failed to load Google Maps"));
    };
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface PlaceResult {
  formatted: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  lat?: number;
  lng?: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: PlaceResult) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Start typing an address…",
  className,
  id,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(() => !!window.google?.maps?.places);

  useEffect(() => {
    if (ready) return;
    setLoading(true);
    loadMapsScript()
      .then(() => {
        setReady(true);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        // Falls back to plain text input silently
      });
  }, [ready]);

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return;

    try {
    const ac = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ["address"],
      componentRestrictions: { country: "us" },
      fields: ["address_components", "formatted_address", "geometry"],
    });

    ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      if (!place.address_components) return;

      const get = (type: string, short = false) => {
        const comp = place.address_components!.find((c) => c.types.includes(type));
        return comp ? (short ? comp.short_name : comp.long_name) : "";
      };

      const streetNumber = get("street_number");
      const route = get("route");
      const street = [streetNumber, route].filter(Boolean).join(" ");
      const city = get("locality") || get("sublocality") || get("administrative_area_level_2");
      const state = get("administrative_area_level_1", true);
      const zip = get("postal_code");
      const formatted = place.formatted_address ?? street;
      const lat = place.geometry?.location?.lat();
      const lng = place.geometry?.location?.lng();

      onChange(street || formatted);
      onPlaceSelect?.({ formatted, street: street || formatted, city, state, zip, lat, lng });
    });

    autocompleteRef.current = ac;
    } catch (err) {
      console.warn("[AddressAutocomplete] Failed to attach autocomplete:", err);
    }
  }, [ready, onChange, onPlaceSelect]);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("pr-8", className)}
        disabled={disabled}
        autoComplete="off"
      />
      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
        ) : ready ? (
          <MapPin className="h-3.5 w-3.5 text-teal-500/70" />
        ) : null}
      </div>
    </div>
  );
}
