/* ==========================================
   ADZAN PRO - FINAL NASIONAL VERSION
   Method 20 (Kemenag / MABIMS)
========================================== */

let userLat = null;
let userLng = null;
let lastLat = null;
let lastLng = null;
let currentDateKey = null;

/* ===============================
   UTIL: HITUNG JARAK (HAVERSINE)
================================= */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/* ===============================
   INIT LOKASI & JADWAL
================================= */
async function initLokasiDanJadwal() {
  document.getElementById("koordinat").innerText =
    `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - memuat elevasi...`;

  await getElevation();
  await reverseGeocode();
  hitungKiblat();
  loadJadwal();
}

/* ===============================
   GPS AUTO TRACKING NASIONAL
================================= */
navigator.geolocation.watchPosition(
  async pos => {
    const newLat = pos.coords.latitude;
    const newLng = pos.coords.longitude;

    if (userLat === null) {
      userLat = newLat;
      userLng = newLng;
      lastLat = newLat;
      lastLng = newLng;

      await initLokasiDanJadwal();
      return;
    }

    const distanceMoved = haversine(lastLat, lastLng, newLat, newLng);

    if (distanceMoved > 5) {
      console.log("📍 Pindah lokasi:", distanceMoved.toFixed(2), "km");

      userLat = newLat;
      userLng = newLng;
      lastLat = newLat;
      lastLng = newLng;

      currentDateKey = null;
      await initLokasiDanJadwal();
    }
  },
  err => {
    document.getElementById("namaLokasi").innerText =
      "❌ Izin lokasi ditolak / GPS tidak aktif";
  },
  {
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000
  }
);

/* ===============================
   REVERSE GEOCODE
================================= */
async function reverseGeocode() {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`
    );
    const data = await res.json();
    document.getElementById("namaLokasi").innerText =
      data.address.city ||
      data.address.town ||
      data.address.village ||
      "Lokasi tidak diketahui";
  } catch {
    document.getElementById("namaLokasi").innerText =
      "Lokasi tidak diketahui";
  }
}

/* ===============================
   ELEVASI
================================= */
async function getElevation() {
  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${userLat},${userLng}`
    );
    const data = await res.json();
    const elev = data.results[0].elevation;

    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} | ${elev} mdpl`;
  } catch {
    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
  }
}

/* ===============================
   HITUNG ARAH KIBLAT
================================= */
function hitungKiblat() {
  const kaabaLat = 21.4225;
  const kaabaLng = 39.8262;

  const dLon = (kaabaLng - userLng) * Math.PI / 180;

  const lat1 = userLat * Math.PI / 180;
  const lat2 = kaabaLat * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let brng = Math.atan2(y, x) * 180 / Math.PI;
  brng = (brng + 360) % 360;

  document.getElementById("arahKiblat").innerText =
    "Arah Kiblat: " + brng.toFixed(2) + "°";
}

/* ===============================
   LOAD JADWAL SHOLAT NASIONAL
================================= */
async function loadJadwal() {
  const today = new Date();
  const dateKey = today.toISOString().split("T")[0];

  if (dateKey === currentDateKey) return;

  currentDateKey = dateKey;

  const cacheKey =
    `jadwal_${dateKey}_${userLat.toFixed(2)}_${userLng.toFixed(2)}`;

  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    tampilkanJadwal(JSON.parse(cached));
    return;
  }

  const response = await fetch(
    `https://api.aladhan.com/v1/timings?latitude=${userLat}&longitude=${userLng}&method=20`
  );

  const data = await response.json();
  const timings = data.data.timings;

  localStorage.setItem(cacheKey, JSON.stringify(timings));
  tampilkanJadwal(timings);
}

/* ===============================
   TAMPILKAN JADWAL
================================= */
function tampilkanJadwal(timings) {
  document.getElementById("subuh").innerText = timings.Fajr;
  document.getElementById("terbit").innerText = timings.Sunrise;
  document.getElementById("dzuhur").innerText = timings.Dhuhr;
  document.getElementById("ashar").innerText = timings.Asr;
  document.getElementById("maghrib").innerText = timings.Maghrib;
  document.getElementById("isya").innerText = timings.Isha;
}
