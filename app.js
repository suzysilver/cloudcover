const statusEl = document.getElementById("status");
const locationEl = document.getElementById("location");
const cloudCoverEl = document.getElementById("cloudCover");
const skyConditionEl = document.getElementById("skyCondition");
const meterFillEl = document.getElementById("meterFill");
const updatedEl = document.getElementById("updated");
const forecastEl = document.getElementById("forecast");
const dailyForecastEl = document.getElementById("dailyForecast");
const retryBtn = document.getElementById("retry");
const zipInputEl = document.getElementById("zipInput");
const zipSearchBtn = document.getElementById("zipSearch");
const useLocationBtn = document.getElementById("useLocation");

const appState = {
  mode: "geo",
  zip: "",
};

function setLoading(isLoading) {
  if (retryBtn) {
    retryBtn.disabled = isLoading;
    retryBtn.textContent = isLoading ? "Loading..." : "Refresh";
  }
  if (zipSearchBtn) {
    zipSearchBtn.disabled = isLoading;
  }
  if (useLocationBtn) {
    useLocationBtn.disabled = isLoading;
  }
}

function clearDisplay() {
  if (locationEl) {
    locationEl.textContent = "";
  }
  if (cloudCoverEl) {
    cloudCoverEl.textContent = "";
  }
  if (skyConditionEl) {
    skyConditionEl.textContent = "";
  }
  if (meterFillEl) {
    meterFillEl.style.width = "0%";
  }
  if (updatedEl) {
    updatedEl.textContent = "";
  }
  if (forecastEl) {
    forecastEl.innerHTML = "";
  }
  if (dailyForecastEl) {
    dailyForecastEl.innerHTML = "";
  }
}

function formatTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

function formatHour(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }
  return date.toLocaleTimeString([], { hour: "numeric" });
}

function formatDayLabel(date) {
  return date.toLocaleDateString([], { weekday: "short" });
}

function formatDayDate(date) {
  return date.toLocaleDateString([], { month: "numeric", day: "numeric" });
}

function getFriendlyError(error) {
  if (error && typeof error === "object" && "code" in error) {
    switch (error.code) {
      case 1:
        return "Location permission denied. Allow location access and try again.";
      case 2:
        return "Location unavailable. Try again in a moment.";
      case 3:
        return "Location request timed out. Try again.";
      default:
        return "Could not determine your location.";
    }
  }

  if (error instanceof TypeError) {
    return "Network error while contacting the weather service.";
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unexpected error while loading cloud cover.";
}

function describeSky(cloudCover) {
  if (cloudCover <= 20) {
    return { label: "Clear", color: "#22c55e", icon: "🌞", tint: "#fff7cc" };
  }
  if (cloudCover <= 50) {
    return { label: "Mostly clear", color: "#84cc16", icon: "🌤️", tint: "#ecfccb" };
  }
  if (cloudCover <= 80) {
    return { label: "Partly cloudy", color: "#f59e0b", icon: "⛅️", tint: "#ffedd5" };
  }
  return { label: "Overcast", color: "#64748b", icon: "☁️", tint: "#e2e8f0" };
}

function sanitizeZip(zipRaw) {
  return zipRaw.trim().replace(/\s+/g, "");
}

function isValidUsZip(zip) {
  return /^\d{5}(-\d{4})?$/.test(zip);
}

async function lookupLocationName(latitude, longitude) {
  const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
  endpoint.searchParams.set("latitude", latitude);
  endpoint.searchParams.set("longitude", longitude);
  endpoint.searchParams.set("count", "1");
  endpoint.searchParams.set("language", "en");

  const response = await fetch(endpoint);
  if (!response.ok) {
    return "";
  }

  const data = await response.json();
  const first = data?.results?.[0];
  if (!first) {
    return "";
  }

  const parts = [first.name, first.admin1, first.country].filter(Boolean);
  return parts.join(", ");
}

async function lookupZip(zip) {
  const endpoint = new URL("https://geocoding-api.open-meteo.com/v1/search");
  endpoint.searchParams.set("name", zip);
  endpoint.searchParams.set("count", "1");
  endpoint.searchParams.set("language", "en");
  endpoint.searchParams.set("country_code", "US");

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`ZIP lookup failed: ${response.status}`);
  }

  const data = await response.json();
  const result = data?.results?.[0];
  if (!result) {
    throw new Error("ZIP code not found.");
  }

  return {
    latitude: result.latitude,
    longitude: result.longitude,
    name: [result.name, result.admin1, result.country].filter(Boolean).join(", "),
  };
}

async function fetchCloudData(latitude, longitude) {
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", latitude);
  endpoint.searchParams.set("longitude", longitude);
  endpoint.searchParams.set("current", "cloud_cover");
  endpoint.searchParams.set("hourly", "cloud_cover");
  endpoint.searchParams.set("forecast_days", "8");
  endpoint.searchParams.set("timezone", "auto");

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const current = data?.current;
  const cloudCover = current?.cloud_cover ?? current?.cloudcover;
  const updated = current?.time;

  const hourly = data?.hourly;
  const hourlyTimes = hourly?.time || [];
  const hourlyCloud = hourly?.cloud_cover || hourly?.cloudcover || [];

  if (cloudCover === undefined || cloudCover === null) {
    throw new Error("Cloud cover data is unavailable right now.");
  }

  if (!Array.isArray(hourlyTimes) || !Array.isArray(hourlyCloud) || hourlyTimes.length === 0 || hourlyCloud.length === 0) {
    throw new Error("24-hour forecast data is unavailable right now.");
  }

  return {
    currentCloudCover: cloudCover,
    updated,
    hourlyTimes,
    hourlyCloud,
  };
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  });
}

function buildForecastItems(hourlyTimes, hourlyCloud) {
  const now = Date.now();
  const startIndex = Math.max(
    0,
    hourlyTimes.findIndex((time) => {
      const timestamp = new Date(time).getTime();
      return Number.isFinite(timestamp) && timestamp > now;
    })
  );
  const items = [];

  for (let i = startIndex; i < hourlyTimes.length && items.length < 24; i += 1) {
    const value = hourlyCloud[i];
    if (value === undefined || value === null) {
      continue;
    }

    items.push({
      time: hourlyTimes[i],
      cloudCover: Math.round(value),
    });
  }

  return items;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDailyForecast(hourlyTimes, hourlyCloud) {
  const todayKey = dateKey(new Date());
  const dayBuckets = new Map();

  for (let i = 0; i < hourlyTimes.length; i += 1) {
    const time = hourlyTimes[i];
    const cover = hourlyCloud[i];
    if (cover === undefined || cover === null) {
      continue;
    }

    const date = new Date(time);
    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const key = dateKey(date);
    if (key <= todayKey) {
      continue;
    }

    const current = dayBuckets.get(key) || { sum: 0, count: 0, date };
    current.sum += cover;
    current.count += 1;
    dayBuckets.set(key, current);
  }

  const items = [];
  for (const [, bucket] of dayBuckets) {
    if (bucket.count === 0) {
      continue;
    }

    items.push({
      day: formatDayLabel(bucket.date),
      date: formatDayDate(bucket.date),
      cloudCover: Math.round(bucket.sum / bucket.count),
    });

    if (items.length === 7) {
      break;
    }
  }

  return items;
}

function renderForecast(items) {
  if (!forecastEl) {
    return;
  }

  if (!items.length) {
    forecastEl.innerHTML = '<p class="muted">No hourly forecast available.</p>';
    return;
  }

  forecastEl.innerHTML = items
    .map((item) => {
      const sky = describeSky(item.cloudCover);
      return `
        <article class="forecast-item" style="background:${sky.tint}; border-color:${sky.color};" aria-label="${formatHour(item.time)} cloud cover ${item.cloudCover}%">
          <p class="forecast-time">${formatHour(item.time)}</p>
          <div class="forecast-icon" title="${sky.label}">${sky.icon}</div>
          <p class="forecast-cloud">${item.cloudCover}%</p>
        </article>
      `;
    })
    .join("");
}

function renderDailyForecast(items) {
  if (!dailyForecastEl) {
    return;
  }

  if (!items.length) {
    dailyForecastEl.innerHTML = '<p class="muted">No 7-day forecast available.</p>';
    return;
  }

  dailyForecastEl.innerHTML = items
    .map((item) => {
      const sky = describeSky(item.cloudCover);
      return `
        <article class="daily-item" style="background:${sky.tint}; border-color:${sky.color};" aria-label="${item.day} cloud cover ${item.cloudCover}%">
          <p class="daily-day">${item.day}</p>
          <p class="daily-date">${item.date}</p>
          <div class="daily-icon" title="${sky.label}">${sky.icon}</div>
          <p class="daily-cloud">${item.cloudCover}%</p>
        </article>
      `;
    })
    .join("");
}

async function resolveTargetLocation() {
  if (appState.mode === "zip") {
    const zip = sanitizeZip(appState.zip || zipInputEl?.value || "");
    if (!isValidUsZip(zip)) {
      throw new Error("Please enter a valid US ZIP code (12345 or 12345-6789).");
    }
    return lookupZip(zip);
  }

  const position = await getCurrentPosition();
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    name: "",
  };
}

async function loadCloudCover() {
  setLoading(true);
  clearDisplay();
  statusEl.textContent = "Getting location...";

  try {
    const target = await resolveTargetLocation();

    statusEl.textContent = "Fetching cloud cover...";
    const weather = await fetchCloudData(target.latitude, target.longitude);

    let place = target.name;
    if (!place) {
      try {
        place = await lookupLocationName(target.latitude, target.longitude);
      } catch (_) {
        // Reverse geocoding is optional.
      }
    }

    const roundedCloudCover = Math.round(weather.currentCloudCover);
    const sky = describeSky(roundedCloudCover);

    statusEl.textContent = "Current cloud cover";
    if (cloudCoverEl) {
      cloudCoverEl.textContent = `${roundedCloudCover}%`;
    }
    if (skyConditionEl) {
      skyConditionEl.textContent = `Sky: ${sky.icon} ${sky.label}`;
    }
    if (meterFillEl) {
      meterFillEl.style.width = `${Math.max(0, Math.min(100, roundedCloudCover))}%`;
      meterFillEl.style.background = sky.color;
    }

    if (place) {
      if (locationEl) {
        locationEl.textContent = place;
      }
    } else {
      if (locationEl) {
        locationEl.textContent = `${target.latitude.toFixed(3)}, ${target.longitude.toFixed(3)}`;
      }
    }

    if (weather.updated) {
      if (updatedEl) {
        updatedEl.textContent = `Updated: ${formatTime(weather.updated)}`;
      }
    }

    const forecastItems = buildForecastItems(weather.hourlyTimes, weather.hourlyCloud);
    renderForecast(forecastItems);
    const dailyItems = buildDailyForecast(weather.hourlyTimes, weather.hourlyCloud);
    renderDailyForecast(dailyItems);
  } catch (error) {
    statusEl.textContent = "Could not load cloud cover.";
    if (updatedEl) {
      updatedEl.textContent = getFriendlyError(error);
    }
  } finally {
    setLoading(false);
  }
}

if (zipSearchBtn) {
  zipSearchBtn.addEventListener("click", () => {
    appState.mode = "zip";
    appState.zip = zipInputEl?.value || "";
    loadCloudCover();
  });
}

if (zipInputEl && zipSearchBtn) {
  zipInputEl.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      zipSearchBtn.click();
    }
  });
}

if (useLocationBtn) {
  useLocationBtn.addEventListener("click", () => {
    appState.mode = "geo";
    loadCloudCover();
  });
}

if (retryBtn) {
  retryBtn.addEventListener("click", loadCloudCover);
}
loadCloudCover();
