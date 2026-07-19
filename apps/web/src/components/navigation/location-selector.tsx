"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { getLocationLabel, locationOptions } from "./public-navigation-model";

export const LOCATION_STORAGE_KEY = "babyloop_marketplace_city";
export const LOCATION_CHANGED_EVENT = "babyloop-marketplace-location-change";
export const DEFAULT_LOCATION = "turkiye";

type LocationSelectorProps = {
  dictionary: Dictionary;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
};

type LocationStatus = "idle" | "loading" | "success" | "error";

const cityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  istanbul: { latitude: 41.0082, longitude: 28.9784 },
  ankara: { latitude: 39.9334, longitude: 32.8597 },
  izmir: { latitude: 38.4237, longitude: 27.1428 },
  bursa: { latitude: 40.1828, longitude: 29.0663 },
  antalya: { latitude: 36.8969, longitude: 30.7133 },
  konya: { latitude: 37.8746, longitude: 32.4932 },
  kocaeli: { latitude: 40.7654, longitude: 29.9408 },
  sakarya: { latitude: 40.7569, longitude: 30.3781 },
  eskisehir: { latitude: 39.7767, longitude: 30.5206 },
  adana: { latitude: 37.0, longitude: 35.3213 }
};

export function LocationSelector({
  dictionary,
  selectedCity,
  setSelectedCity
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      setLocationMessage(dictionary.publicShell.location.unsupported);
      return;
    }

    setLocationStatus("loading");
    setLocationMessage("Konumun alınıyor...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearestCity = findNearestSupportedCity(
          position.coords.latitude,
          position.coords.longitude
        );

        setSelectedCity(nearestCity);
        setLocationStatus("success");
        setLocationMessage(dictionary.publicShell.location.selected.replace("{city}", getLocationLabel(nearestCity, dictionary)));

        window.setTimeout(() => {
          setIsOpen(false);
        }, 900);
      },
      () => {
        setLocationStatus("error");
        setLocationMessage("Konum izni verilmedi.");
      },
      {
        enableHighAccuracy: false,
        maximumAge: 1000 * 60 * 10,
        timeout: 8000
      }
    );
  }

  function useAllTurkey() {
    selectCity("turkiye");
  }

  function selectCity(city: string) {
    setSelectedCity(city);
    setLocationStatus("idle");
    setLocationMessage(null);
    setIsOpen(false);
  }

  return (
    <div className="market-location" ref={rootRef}>
      <button
        aria-controls="market-location-menu"
        aria-expanded={isOpen}
        aria-label={dictionary.publicShell.header.locationAria}
        className="market-location-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span aria-hidden="true">⌖</span>
        {getLocationLabel(selectedCity, dictionary)}
      </button>

      {isOpen ? (
        <div className="market-location-menu market-location-menu-detect-only" id="market-location-menu" role="dialog">
          <div className="market-location-heading">
            <div>
              <strong>Konum</strong>
            </div>

            <button type="button" aria-label="Kapat" onClick={() => setIsOpen(false)}>
              ×
            </button>
          </div>

          <div className="market-location-current">
            <span>Seçili konum</span>
            <strong>{getLocationLabel(selectedCity, dictionary)}</strong>
          </div>

          <label className="mobile-market-location-field">
            <span>{dictionary.publicShell.location.selectCity}</span>
            <select
              aria-label={dictionary.publicShell.header.locationAria}
              value={selectedCity}
              onChange={(event) => selectCity(event.target.value)}
            >
              {locationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {getLocationLabel(option.value, dictionary)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="market-location-detect"
            type="button"
            disabled={locationStatus === "loading"}
            onClick={useCurrentLocation}
          >
            <span aria-hidden="true">📍</span>
            <strong>
              {locationStatus === "loading" ? dictionary.publicShell.location.locatingButton : dictionary.publicShell.location.useCurrent}
            </strong>
          </button>

          {locationMessage ? (
            <p className={`market-location-status is-${locationStatus}`} role="status">
              {locationMessage}
            </p>
          ) : null}

          <button className="market-location-all-country" type="button" onClick={useAllTurkey}>
            Türkiye genelinde ara
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function readStoredLocation(): string {
  try {
    const storedCity = window.localStorage.getItem(LOCATION_STORAGE_KEY);

    return locationOptions.some((option) => option.value === storedCity)
      ? storedCity ?? DEFAULT_LOCATION
      : DEFAULT_LOCATION;
  } catch {
    return DEFAULT_LOCATION;
  }
}

export function storeLocation(city: string): void {
  try {
    window.localStorage.setItem(LOCATION_STORAGE_KEY, city);
  } catch {
    return;
  }
}

function findNearestSupportedCity(latitude: number, longitude: number): string {
  let nearestCity = DEFAULT_LOCATION;
  let nearestDistance = Number.POSITIVE_INFINITY;

  Object.entries(cityCoordinates).forEach(([city, coordinates]) => {
    const distance = getDistanceScore(
      latitude,
      longitude,
      coordinates.latitude,
      coordinates.longitude
    );

    if (distance < nearestDistance) {
      nearestCity = city;
      nearestDistance = distance;
    }
  });

  return nearestCity;
}

function getDistanceScore(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number
): number {
  return Math.hypot(latitudeA - latitudeB, longitudeA - longitudeB);
}
