"use client";

import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "../../lib/i18n/dictionaries";
import { getLocationLabel, locationOptions } from "./public-navigation-model";

export const LOCATION_STORAGE_KEY = "babyloop_marketplace_city";
export const DEFAULT_LOCATION = "istanbul";

type LocationSelectorProps = {
  dictionary: Dictionary;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
};

export function LocationSelector({
  dictionary,
  selectedCity,
  setSelectedCity
}: LocationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  function selectCity(city: string) {
    setSelectedCity(city);
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
        {getLocationLabel(selectedCity)}
      </button>

      {isOpen ? (
        <div className="market-location-menu" id="market-location-menu" role="dialog">
          <div className="market-location-heading">
            <strong>{dictionary.publicShell.location.selectCity}</strong>
            <button type="button" onClick={() => setIsOpen(false)}>
              {dictionary.publicShell.header.close}
            </button>
          </div>
          <p>{dictionary.publicShell.location.helper}</p>
          <div className="market-location-options">
            {locationOptions.map((option) => (
              <button
                aria-pressed={selectedCity === option.value}
                key={option.value}
                type="button"
                onClick={() => selectCity(option.value)}
              >
                {option.value === "turkiye"
                  ? dictionary.publicShell.location.allTurkey
                  : option.label}
              </button>
            ))}
          </div>
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
