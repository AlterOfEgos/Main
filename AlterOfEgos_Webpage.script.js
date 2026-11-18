const utils = window.WeatherUtils;
const weatherSearch = document.getElementById("weather-search");
const weatherStatus = document.getElementById("weather-status");
const weatherResults = document.getElementById("weather-results");
const forecastList = document.getElementById("forecast-list");
const temperatureUnit = document.getElementById("temperature-unit");
const locationChoices = document.getElementById("location-choices");
const cityInput = document.getElementById("weather-city");
const searchButton = weatherSearch.querySelector('button[type="submit"]');
const locationButton = document.getElementById("use-location");
const PREFERENCES_KEY = "alterofegos-weather-preferences";
const EMAILJS_URL = "https://cdn.emailjs.com/dist/email.min.js";
let emailJsLoadPromise = null;
let emailJsInitialized = false;
const weatherRequestCache = utils.createRequestCache(window.fetch.bind(window));

function loadEmailJs() {
    if (window.emailjs) {
        if (!emailJsInitialized) {
            window.emailjs.init("lz1RP-zscAZDnEhq1");
            emailJsInitialized = true;
        }
        return Promise.resolve(window.emailjs);
    }

    if (!emailJsLoadPromise) {
        const script = document.createElement("script");
        script.src = EMAILJS_URL;
        script.async = true;

        emailJsLoadPromise = new Promise((resolve, reject) => {
            script.addEventListener("load", resolve, { once: true });
            script.addEventListener("error", () => reject(new Error("Unable to load the contact service.")), { once: true });
            document.head.append(script);
        }).then(() => {
            if (!window.emailjs) throw new Error("The contact service is unavailable.");
            window.emailjs.init("lz1RP-zscAZDnEhq1");
            emailJsInitialized = true;
            return window.emailjs;
        }).catch((error) => {
            emailJsLoadPromise = null;
            throw error;
        });
    }
    return emailJsLoadPromise;
}

function readPreferences() {
    try {
        const preferences = JSON.parse(window.localStorage.getItem(PREFERENCES_KEY) || "{}");
        const location = preferences.location;
        const validLocation = location && Number.isFinite(location.latitude) &&
            Number.isFinite(location.longitude) && typeof location.label === "string";

        return {
            unit: preferences.unit === "fahrenheit" ? "fahrenheit" : "celsius",
            location: validLocation ? location : null
        };
    } catch (error) {
        // Storage may be unavailable or contain invalid JSON; use the defaults.
        return { unit: "celsius", location: null };
    }
}

const savedPreferences = readPreferences();
temperatureUnit.value = savedPreferences.unit;
let savedLocation = savedPreferences.location;
let selectedLocation = null;
let isBusy = false;

if (savedLocation) cityInput.value = savedLocation.label;

function savePreferences() {
    try {
        window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({
            unit: temperatureUnit.value,
            location: savedLocation
        }));
    } catch (error) {
        // Weather still works if browser storage is disabled or full.
    }
}

function setWeatherStatus(message, isError = false) {
    weatherStatus.textContent = message;
    weatherStatus.classList.toggle("error", isError);
}

function setBusy(busy) {
    isBusy = busy;
    searchButton.disabled = busy;
    locationButton.disabled = busy;
    temperatureUnit.disabled = busy;
    weatherSearch.setAttribute("aria-busy", String(busy));
    weatherResults.setAttribute("aria-busy", String(busy));
}

async function getJson(url) {
    return weatherRequestCache(url, undefined, 15000);
}

function showLocationChoices(locations) {
    locationChoices.replaceChildren();
    locations.forEach((location) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "location-choice";
        button.textContent = location.label;
        button.addEventListener("click", () => {
            if (isBusy) return;
            locationChoices.hidden = true;
            loadWeather(location);
        });
        locationChoices.append(button);
    });
    locationChoices.hidden = false;
    setWeatherStatus(`Found ${locations.length} matching locations. Choose the correct one.`);
    locationChoices.querySelector("button")?.focus();
}

async function searchCity(city) {
    setBusy(true);
    locationChoices.hidden = true;
    setWeatherStatus(`Searching for ${city}…`);
    try {
        const result = await getJson(utils.buildGeocodingUrl(city));
        const locations = utils.normalizeLocations(result.results);
        if (locations.length === 0) {
            throw new Error(`No location found for “${city}”. Check the spelling and try again.`);
        }
        if (locations.length > 1) {
            showLocationChoices(locations);
            setBusy(false);
            return;
        }
        await loadWeather(locations[0], true);
    } catch (error) {
        setWeatherStatus(error.message || "Unable to search for that city. Please try again.", true);
        setBusy(false);
    }
}

async function loadWeather(location, alreadyBusy = false, rememberLocation = true) {
    if (isBusy && !alreadyBusy) return;
    setBusy(true);
    locationChoices.hidden = true;
    setWeatherStatus(`Loading forecast for ${location.label}…`);

    try {
        const unit = temperatureUnit.value;
        const data = await getJson(utils.buildForecastUrl(location, unit));
        renderWeather(location, data, unit);
        selectedLocation = location;
        weatherResults.hidden = false;
        if (rememberLocation) {
            savedLocation = location;
            cityInput.value = location.label;
            savePreferences();
        }
        setWeatherStatus(`Forecast loaded for ${location.label}.`);
    } catch (error) {
        // Keep the last successful forecast visible if a refresh fails.
        setWeatherStatus(error.message || "Unable to load weather. Please try again.", true);
    } finally {
        setBusy(false);
    }
}

function renderWeather(location, data, unit) {
    const current = data.current;
    const [description, icon] = utils.getConditions(current.weather_code);
    document.getElementById("current-city").textContent = location.label;
    document.getElementById("current-description").textContent = description;
    document.getElementById("current-icon").textContent = icon;
    document.getElementById("current-temperature").textContent = utils.formatTemperature(current.temperature_2m, unit);
    document.getElementById("feels-like").textContent = utils.formatTemperature(current.apparent_temperature, unit);
    document.getElementById("humidity").textContent = `${current.relative_humidity_2m}%`;
    document.getElementById("wind-speed").textContent = `${Math.round(current.wind_speed_10m)} ${unit === "fahrenheit" ? "mph" : "km/h"}`;

    forecastList.replaceChildren();
    data.daily.time.forEach((date, index) => {
        const [dayDescription, dayIcon] = utils.getConditions(data.daily.weather_code[index]);
        const day = document.createElement("article");
        day.className = "forecast-day";
        day.setAttribute("role", "listitem");

        const heading = document.createElement("h4");
        heading.textContent = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(new Date(`${date}T12:00:00`));
        const iconElement = document.createElement("span");
        iconElement.className = "forecast-icon";
        iconElement.setAttribute("aria-hidden", "true");
        iconElement.textContent = dayIcon;
        const condition = document.createElement("p");
        condition.textContent = dayDescription;
        const range = document.createElement("p");
        range.className = "forecast-range";
        range.textContent = `${utils.formatTemperature(data.daily.temperature_2m_max[index], unit)} / ${utils.formatTemperature(data.daily.temperature_2m_min[index], unit)}`;

        day.append(heading, iconElement, condition, range);
        forecastList.append(day);
    });
}

weatherSearch.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isBusy) return;
    const city = cityInput.value.trim();
    if (city) searchCity(city);
});

temperatureUnit.addEventListener("change", () => {
    savePreferences();
    if (selectedLocation && !isBusy) loadWeather(selectedLocation);
});

locationButton.addEventListener("click", () => {
    if (isBusy) return;
    if (!navigator.geolocation) {
        setWeatherStatus("Location access is not available in this browser. Search for a city instead.", true);
        return;
    }

    setBusy(true);
    setWeatherStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
        ({ coords }) => loadWeather({
            latitude: coords.latitude,
            longitude: coords.longitude,
            label: "Your location"
        }, true, false),
        (error) => {
            const message = error.code === error.PERMISSION_DENIED
                ? "Location permission was denied. Search for a city instead."
                : "Could not get your location. Search for a city instead.";
            setWeatherStatus(message, true);
            setBusy(false);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
});

const contactForm = document.getElementById("contact-form");
if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = document.getElementById("form-status");
        const submitButton = contactForm.querySelector('button[type="submit"]');
        if (submitButton.disabled) return;

        submitButton.disabled = true;
        status.textContent = "Sending your message…";
        try {
            const emailjs = await loadEmailJs();
            await emailjs.sendForm("service_69w7fcj", "template_qm9dhuy", contactForm);
            status.textContent = "Message sent successfully.";
            contactForm.reset();
        } catch (error) {
            status.textContent = "Failed to send your message. Please try again later.";
        } finally {
            submitButton.disabled = false;
        }
    });
}

// Restore the last searched city automatically; device coordinates are never saved.
if (savedLocation) loadWeather(savedLocation);

const hero = document.getElementById("hero");
if (hero && typeof window.matchMedia === "function" && window.matchMedia("(pointer: fine)").matches) {
    hero.addEventListener("pointermove", (event) => {
        const rect = hero.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        hero.style.setProperty("--pointer-x", `${x * 10}px`);
        hero.style.setProperty("--pointer-y", `${y * 10}px`);
    });
}
