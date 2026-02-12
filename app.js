const statusEl = document.getElementById("status");
const locationEl = document.getElementById("location");
const cloudCoverEl = document.getElementById("cloudCover");
const skyConditionEl = document.getElementById("skyCondition");
const meterFillEl = document.getElementById("meterFill");
const updatedEl = document.getElementById("updated");
const retryBtn = document.getElementById("retry");

function setLoading(isLoading) {
  retryBtn.disabled = isLoading;
  retryBtn.textContent = isLoading ? "Loading..." : "Refresh";
}

function clearDisplay() {
  locationEl.textContent = "";
  cloudCoverEl.textContent = "";
  skyConditionEl.textContent = "";
  meterFillEl.style.width = "0%";
  updatedEl.textContent = "";
}

function describeSky(cloudCover) {
  if (cloudCover <= 20) {
    return { label: "Clear", color: "#22c55e" };
  }
  if (cloudCover <= 50) {
    return { label: "Mostly clear", color: "#84cc16" };
  }
  if (cloudCover <= 80) {
    return { label: "Partly cloudy", color: "#f59e0b" };
  }
  return { label: "Overcast", color: "#64748b" };
}

function formatTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
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

async function fetchCloudCover(latitude, longitude) {
  const endpoint = new URL("https://api.open-meteo.com/v1/forecast");
  endpoint.searchParams.set("latitude", latitude);
  endpoint.searchParams.set("longitude", longitude);
  endpoint.searchParams.set("current", "cloud_cover");
  endpoint.searchParams.set("timezone", "auto");

  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  const current = data?.current;
  const cloudCover = current?.cloud_cover ?? current?.cloudcover;
  const updated = current?.time;

  if (cloudCover === undefined || cloudCover === null) {
    throw new Error("Cloud cover data is unavailable right now.");
  }

  return { cloudCover, updated };
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

async function loadCloudCover() {
  setLoading(true);
  clearDisplay();
  statusEl.textContent = "Getting your location...";

  try {
    const position = await getCurrentPosition();
    const { latitude, longitude } = position.coords;

    statusEl.textContent = "Fetching cloud cover...";

    const weather = await fetchCloudCover(latitude, longitude);

    let place = "";
    try {
      place = await lookupLocationName(latitude, longitude);
    } catch (_) {
      // Reverse geocoding is optional; keep app functional if it fails.
    }

    statusEl.textContent = "Current cloud cover";
    const roundedCloudCover = Math.round(weather.cloudCover);
    const sky = describeSky(roundedCloudCover);
    cloudCoverEl.textContent = `${roundedCloudCover}%`;
    skyConditionEl.textContent = `Sky: ${sky.label}`;
    meterFillEl.style.width = `${Math.max(0, Math.min(100, roundedCloudCover))}%`;
    meterFillEl.style.background = sky.color;

    if (place) {
      locationEl.textContent = place;
    } else {
      locationEl.textContent = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
    }

    if (weather.updated) {
      updatedEl.textContent = `Updated: ${formatTime(weather.updated)}`;
    }
  } catch (error) {
    statusEl.textContent = "Could not load cloud cover.";
    cloudCoverEl.textContent = "";
    skyConditionEl.textContent = "";
    meterFillEl.style.width = "0%";
    updatedEl.textContent = getFriendlyError(error);
  } finally {
    setLoading(false);
  }
}

retryBtn.addEventListener("click", loadCloudCover);
loadCloudCover();
