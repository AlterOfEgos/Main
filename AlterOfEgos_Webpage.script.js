const weatherCodes = {
    0: ["Clear sky", "☀️"],
    1: ["Mainly clear", "🌤️"],
    2: ["Partly cloudy", "⛅"],
    3: ["Overcast", "☁️"],
    45: ["Fog", "🌫️"],
    48: ["Depositing rime fog", "🌫️"],
    51: ["Light drizzle", "🌦️"],
    53: ["Moderate drizzle", "🌦️"],
    55: ["Dense drizzle", "🌧️"],
    56: ["Light freezing drizzle", "🌧️"],
    57: ["Dense freezing drizzle", "🌧️"],
    61: ["Slight rain", "🌧️"],
    63: ["Moderate rain", "🌧️"],
    65: ["Heavy rain", "🌧️"],
    66: ["Light freezing rain", "🌧️"],
    67: ["Heavy freezing rain", "🌧️"],
    71: ["Slight snow", "🌨️"],
    73: ["Moderate snow", "🌨️"],
    75: ["Heavy snow", "❄️"],
    77: ["Snow grains", "🌨️"],
    80: ["Slight rain showers", "🌦️"],
    81: ["Moderate rain showers", "🌧️"],
    82: ["Violent rain showers", "⛈️"],
    85: ["Slight snow showers", "🌨️"],
    86: ["Heavy snow showers", "❄️"],
    95: ["Thunderstorm", "⛈️"],
    96: ["Thunderstorm with slight hail", "⛈️"],
    99: ["Thunderstorm with heavy hail", "⛈️"]
};

const weatherSearch = document.getElementById("weather-search");
const weatherStatus = document.getElementById("weather-status");
const weatherResults = document.getElementById("weather-results");
const forecastList = document.getElementById("forecast-list");
const temperatureUnit = document.getElementById("temperature-unit");
let selectedLocation = null;

function getConditions(code) {
    return weatherCodes[code] || ["Conditions unavailable", "🌡️"];
}

function formatTemperature(value, unit) {
    return `${Math.round(value)}°${unit === "fahrenheit" ? "F" : "C"}`;
}

function setWeatherStatus(message, isError = false) {
    weatherStatus.textContent = message;
    weatherStatus.classList.toggle("error", isError);
}

async function getJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("The weather service is temporarily unavailable. Please try again.");
    }
    return response.json();
}

async function searchCity(city) {
    setWeatherStatus(`Looking up ${city}…`);
    const params = new URLSearchParams({ name: city, count: "1", language: "en", format: "json" });
    const result = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
    if (!result.results || result.results.length === 0) {
        throw new Error(`No location found for “${city}”. Check the spelling and try again.`);
    }

    const place = result.results[0];
    const label = [place.name, place.admin1, place.country].filter(Boolean).join(", ");
    return { latitude: place.latitude, longitude: place.longitude, label };
}

async function loadWeather(location) {
    selectedLocation = location;
    weatherResults.hidden = true;
    setWeatherStatus(`Loading forecast for ${location.label}…`);

    const unit = temperatureUnit.value;
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
    const data = await getJson(`https://api.open-meteo.com/v1/forecast?${params}`);
    renderWeather(location, data, unit);
    weatherResults.hidden = false;
    setWeatherStatus(`Forecast loaded for ${location.label}.`);
}

function renderWeather(location, data, unit) {
    const current = data.current;
    const [description, icon] = getConditions(current.weather_code);
    document.getElementById("current-city").textContent = location.label;
    document.getElementById("current-description").textContent = description;
    document.getElementById("current-icon").textContent = icon;
    document.getElementById("current-temperature").textContent = formatTemperature(current.temperature_2m, unit);
    document.getElementById("feels-like").textContent = formatTemperature(current.apparent_temperature, unit);
    document.getElementById("humidity").textContent = `${current.relative_humidity_2m}%`;
    document.getElementById("wind-speed").textContent = `${Math.round(current.wind_speed_10m)} ${unit === "fahrenheit" ? "mph" : "km/h"}`;

    forecastList.replaceChildren();
    data.daily.time.forEach((date, index) => {
        const [dayDescription, dayIcon] = getConditions(data.daily.weather_code[index]);
        const day = document.createElement("article");
        day.className = "forecast-day";

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
        range.textContent = `${formatTemperature(data.daily.temperature_2m_max[index], unit)} / ${formatTemperature(data.daily.temperature_2m_min[index], unit)}`;

        day.append(heading, iconElement, condition, range);
        forecastList.append(day);
    });
}

weatherSearch.addEventListener("submit", async (event) => {
    event.preventDefault();
    const city = document.getElementById("weather-city").value.trim();
    if (!city) return;

    try {
        const location = await searchCity(city);
        await loadWeather(location);
    } catch (error) {
        setWeatherStatus(error.message || "Unable to load weather. Please try again.", true);
    }
});

temperatureUnit.addEventListener("change", async () => {
    if (!selectedLocation) return;
    try {
        await loadWeather(selectedLocation);
    } catch (error) {
        setWeatherStatus(error.message || "Unable to load weather. Please try again.", true);
    }
});

document.getElementById("use-location").addEventListener("click", () => {
    if (!navigator.geolocation) {
        setWeatherStatus("Location access is not available in this browser. Search for a city instead.", true);
        return;
    }

    setWeatherStatus("Requesting your location…");
    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
            try {
                await loadWeather({
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    label: "Your location"
                });
            } catch (error) {
                setWeatherStatus(error.message || "Unable to load weather. Please try again.", true);
            }
        },
        (error) => {
            const message = error.code === error.PERMISSION_DENIED
                ? "Location permission was denied. Search for a city instead."
                : "Could not get your location. Search for a city instead.";
            setWeatherStatus(message, true);
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

        if (!window.emailjs) {
            status.textContent = "The contact service is unavailable. Please try again later.";
            return;
        }

        submitButton.disabled = true;
        status.textContent = "Sending your message…";
        try {
            await window.emailjs.sendForm("service_69w7fcj", "template_qm9dhuy", contactForm);
            status.textContent = "Message sent successfully.";
            contactForm.reset();
        } catch (error) {
            status.textContent = "Failed to send your message. Please try again later.";
        } finally {
            submitButton.disabled = false;
        }
    });

    if (window.emailjs) {
        window.emailjs.init("lz1RP-zscAZDnEhq1");
    }
}
