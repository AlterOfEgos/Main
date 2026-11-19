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
        return `${Math.round(value)}°${unit === "fahrenheit" ? "F" : "C"}`;
    }

    function buildGeocodingUrl(city) {
        const params = new URLSearchParams({ name: city, count: "10", language: "en", format: "json" });
        return `https://geocoding-api.open-meteo.com/v1/search?${params}`;
    }

    function normalizeLocations(results) {
        return (results || []).filter((place) => Number.isFinite(place.latitude) && Number.isFinite(place.longitude))
            .map((place) => ({
                latitude: place.latitude,
                longitude: place.longitude,
                label: [place.name, place.admin1, place.country].filter(Boolean).join(", ")
            }));
    }

    function buildForecastUrl(location, unit) {
        const params = new URLSearchParams({
            latitude: String(location.latitude),
            longitude: String(location.longitude),
            current: "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
            daily: "weather_code,temperature_2m_max,temperature_2m_min",
            temperature_unit: unit,
            wind_speed_unit: unit === "fahrenheit" ? "mph" : "kmh",
            timezone: "auto",
            forecast_days: "5"
        });
        return `https://api.open-meteo.com/v1/forecast?${params}`;
    }

    async function requestJson(fetchImpl, url, signal) {
        const response = await fetchImpl(url, { signal });
        if (!response.ok) {
            throw new Error("The weather service is temporarily unavailable. Please try again.");
        }
        return response.json();
    }

    function createRequestCache(fetchImpl, ttlMs = 300000, now = Date.now) {
        const cache = new Map();

        async function get(url) {
            const cached = cache.get(url);
            if (cached) {
                if (cached.expiresAt > now()) return cached.value;
                cache.delete(url);
            }

            const pending = requestJson(fetchImpl, url)
                .then((value) => {
                    cache.set(url, { value, expiresAt: now() + ttlMs });
                    return value;
                })
                .catch((error) => {
                    cache.delete(url);
                    throw error;
                });
            cache.set(url, { value: pending, expiresAt: Infinity });
            return pending;
        }

        return { get };
    }

    return { getConditions, formatTemperature, buildGeocodingUrl, normalizeLocations, buildForecastUrl, requestJson, createRequestCache };
});
