(function (root, factory) {
    const api = factory();
    if (typeof module === "object" && module.exports) module.exports = api;
    if (root) root.WeatherUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
    "use strict";

    const weatherCodes = {
        0: ["Clear sky", "☀️"], 1: ["Mainly clear", "🌤️"],
        2: ["Partly cloudy", "⛅"], 3: ["Overcast", "☁️"],
        45: ["Fog", "🌫️"], 48: ["Depositing rime fog", "🌫️"],
        51: ["Light drizzle", "🌦️"], 53: ["Moderate drizzle", "🌦️"],
        55: ["Dense drizzle", "🌧️"], 56: ["Light freezing drizzle", "🌧️"],
        57: ["Dense freezing drizzle", "🌧️"], 61: ["Slight rain", "🌧️"],
        63: ["Moderate rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
        66: ["Light freezing rain", "🌧️"], 67: ["Heavy freezing rain", "🌧️"],
        71: ["Slight snow", "🌨️"], 73: ["Moderate snow", "🌨️"],
        75: ["Heavy snow", "❄️"], 77: ["Snow grains", "🌨️"],
        80: ["Slight rain showers", "🌦️"], 81: ["Moderate rain showers", "🌧️"],
        82: ["Violent rain showers", "⛈️"], 85: ["Slight snow showers", "🌨️"],
        86: ["Heavy snow showers", "❄️"], 95: ["Thunderstorm", "⛈️"],
        96: ["Thunderstorm with slight hail", "⛈️"], 99: ["Thunderstorm with heavy hail", "⛈️"]
    };

    function getConditions(code) {
        return weatherCodes[code] || ["Conditions unavailable", "🌡️"];
    }

    function formatTemperature(value, unit) {
        if (!Number.isFinite(value)) return "Unavailable";
        return `${Math.round(value)}°${unit === "fahrenheit" ? "F" : "C"}`;
    }

    function buildGeocodingUrl(city) {
        const name = typeof city === "string" ? city.trim() : "";
        if (!name) throw new Error("Enter a city name.");
        const params = new URLSearchParams({ name, count: "10", language: "en", format: "json" });
        return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
    }

    function normalizeLocations(results) {
        const seen = new Set();
        return (results || []).reduce((locations, place) => {
            if (!place || !Number.isFinite(place.latitude) || !Number.isFinite(place.longitude)) return locations;
            if (place.latitude < -90 || place.latitude > 90 || place.longitude < -180 || place.longitude > 180) return locations;

            const key = `${place.latitude},${place.longitude}`;
            if (seen.has(key)) return locations;
            seen.add(key);

            const label = [place.name, place.admin1, place.country].filter((part) => typeof part === "string" && part.trim()).join(", ");
            if (!label) return locations;
            locations.push({
                latitude: place.latitude,
                longitude: place.longitude,
                label
            });
            return locations;
        }, []);
    }

    function buildForecastUrl(location, unit) {
        if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
            throw new Error("A valid location is required.");
        }
        if (location.latitude < -90 || location.latitude > 90 || location.longitude < -180 || location.longitude > 180) {
            throw new Error("A valid location is required.");
        }
        const temperatureUnit = unit === "fahrenheit" ? "fahrenheit" : "celsius";
        const params = new URLSearchParams({
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            daily: "weather_code,temperature_2m_max,temperature_2m_min",
            temperature_unit: temperatureUnit,
            wind_speed_unit: temperatureUnit === "fahrenheit" ? "mph" : "kmh",
            timezone: "auto",
            forecast_days: "5"
        });
        return `https://api.open-meteo.com/v1/forecast?${params}`;
    }

    async function requestJson(fetchImpl, url, signal, timeoutMs = 15000) {
        const controller = typeof AbortController === "function" ? new AbortController() : null;
        let timedOut = false;
        const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0
            ? setTimeout(() => {
                timedOut = true;
                controller?.abort();
            }, timeoutMs)
            : null;
        const relayAbort = () => controller?.abort();
        if (signal?.addEventListener) signal.addEventListener("abort", relayAbort, { once: true });

        try {
            const response = await fetchImpl(url, { signal: controller?.signal || signal });
            if (!response.ok) {
                throw new Error("The weather service is temporarily unavailable. Please try again.");
            }
            return await response.json();
        } catch (error) {
            if (timedOut) {
                throw new Error("The weather request timed out. Please try again.");
            }
            if (error?.name === "AbortError") throw new Error("The weather request was canceled.");
            if (error instanceof SyntaxError) throw new Error("The weather service returned an invalid response.");
            throw error;
        } finally {
            if (timeout) clearTimeout(timeout);
            if (signal?.removeEventListener) signal.removeEventListener("abort", relayAbort);
        }
    }

    function createRequestCache(ttlMs = 10 * 60 * 1000) {
        const entries = new Map();

        function getOrLoad(key, loader) {
            const now = Date.now();
            const existing = entries.get(key);
            if (existing && existing.expiresAt > now) return existing.promise;
            if (existing) entries.delete(key);

            const promise = Promise.resolve().then(loader);
            entries.set(key, {
                expiresAt: now + ttlMs,
                promise
            });
            promise.catch(() => {
                if (entries.get(key)?.promise === promise) entries.delete(key);
            });
            return promise;
        }

        return { getOrLoad };
    }

    return { getConditions, formatTemperature, buildGeocodingUrl, normalizeLocations, buildForecastUrl, requestJson, createRequestCache };
});
