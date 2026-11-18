const test = require("node:test");
const assert = require("node:assert/strict");
const weather = require("../weather-utils.js");

test("maps known and unknown weather codes to useful descriptions", () => {
    assert.deepEqual(weather.getConditions(0), ["Clear sky", "☀️"]);
    assert.deepEqual(weather.getConditions(95), ["Thunderstorm", "⛈️"]);
    assert.deepEqual(weather.getConditions(12345), ["Conditions unavailable", "🌡️"]);
});

test("formats Celsius and Fahrenheit values", () => {
    assert.equal(weather.formatTemperature(18.6, "celsius"), "19°C");
    assert.equal(weather.formatTemperature(65.2, "fahrenheit"), "65°F");
    assert.equal(weather.formatTemperature(NaN, "celsius"), "Unavailable");
});

test("forecast request uses the selected temperature and wind units", () => {
    const location = { latitude: 40.7, longitude: -74, label: "New York" };
    const celsius = new URL(weather.buildForecastUrl(location, "celsius"));
    const fahrenheit = new URL(weather.buildForecastUrl(location, "fahrenheit"));
    assert.equal(celsius.searchParams.get("temperature_unit"), "celsius");
    assert.equal(celsius.searchParams.get("wind_speed_unit"), "kmh");
    assert.equal(fahrenheit.searchParams.get("temperature_unit"), "fahrenheit");
    assert.equal(fahrenheit.searchParams.get("wind_speed_unit"), "mph");
});

test("geocoding search encodes the city and requests multiple matches", () => {
    const url = new URL(weather.buildGeocodingUrl("Springfield & nearby"));
    assert.equal(url.searchParams.get("name"), "Springfield & nearby");
    assert.equal(url.searchParams.get("count"), "10");
});

test("geocoding search trims city input and rejects an empty search", () => {
    assert.equal(new URL(weather.buildGeocodingUrl("  Paris  ")).searchParams.get("name"), "Paris");
    assert.throws(() => weather.buildGeocodingUrl("   "), /Enter a city name/);
});

test("normalizes multiple same-name city matches with identifying region details", () => {
    const locations = weather.normalizeLocations([
        { name: "Springfield", admin1: "Illinois", country: "United States", latitude: 39.8, longitude: -89.6 },
        { name: "Springfield", admin1: "Missouri", country: "United States", latitude: 37.2, longitude: -93.3 }
    ]);
    assert.equal(locations.length, 2);
    assert.equal(locations[0].label, "Springfield, Illinois, United States");
    assert.equal(locations[1].label, "Springfield, Missouri, United States");
});

test("normalization ignores incomplete geocoding results", () => {
    assert.deepEqual(weather.normalizeLocations([{ name: "Unknown", latitude: null, longitude: 1 }]), []);
});

test("normalization removes duplicates and out-of-range coordinates", () => {
    const locations = weather.normalizeLocations([
        { name: "Paris", latitude: 48.85, longitude: 2.35 },
        { name: "Paris duplicate", latitude: 48.85, longitude: 2.35 },
        { name: "Invalid", latitude: 91, longitude: 2.35 }
    ]);
    assert.equal(locations.length, 1);
    assert.equal(locations[0].label, "Paris");
});

test("forecast URL rejects invalid locations", () => {
    assert.throws(() => weather.buildForecastUrl({ latitude: 91, longitude: 0 }, "celsius"), /valid location/);
});

test("requestJson returns parsed JSON for a successful response", async () => {
    const payload = { results: [{ name: "Paris" }] };
    const fetchStub = async () => ({ ok: true, json: async () => payload });
    assert.deepEqual(await weather.requestJson(fetchStub, "https://example.test"), payload);
});

test("requestJson reports failed HTTP responses", async () => {
    const fetchStub = async () => ({ ok: false, json: async () => ({}) });
    await assert.rejects(
        weather.requestJson(fetchStub, "https://example.test"),
        /weather service is temporarily unavailable/
    );
});

test("requestJson propagates network errors", async () => {
    const fetchStub = async () => { throw new Error("offline"); };
    await assert.rejects(weather.requestJson(fetchStub, "https://example.test"), /offline/);
});

test("requestJson times out stalled weather requests", async () => {
    const fetchStub = async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
        }, { once: true });
    });
    await assert.rejects(
        weather.requestJson(fetchStub, "https://example.test", undefined, 5),
        /request timed out/
    );
});

test("createRequestCache caches successful responses and deduplicates concurrent requests", async () => {
    let fetchCount = 0;
    const payload = { current: { temperature_2m: 20 } };
    const fetchStub = async () => {
        fetchCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return { ok: true, json: async () => payload };
    };
    const cachedRequest = weather.createRequestCache(fetchStub, 60000);

    const [first, second] = await Promise.all([
        cachedRequest("https://example.test/weather"),
        cachedRequest("https://example.test/weather")
    ]);

    assert.deepEqual(first, payload);
    assert.deepEqual(second, payload);
    assert.equal(fetchCount, 1);
    assert.deepEqual(await cachedRequest("https://example.test/weather"), payload);
    assert.equal(fetchCount, 1);
});

test("createRequestCache does not retain failed responses", async () => {
    let fetchCount = 0;
    const fetchStub = async () => {
        fetchCount += 1;
        return { ok: false, json: async () => ({}) };
    };
    const cachedRequest = weather.createRequestCache(fetchStub, 60000);

    await assert.rejects(cachedRequest("https://example.test/failure"));
    await assert.rejects(cachedRequest("https://example.test/failure"));
    assert.equal(fetchCount, 2);
});
