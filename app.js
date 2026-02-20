/* ===================================================
   ADZAN PRO - FINAL PRODUCTION BY ARIADI FORESTER
=================================================== */

const KAABAH = { lat: 21.4225, lng: 39.8262 };

let countdownInterval = null;
let currentTimes = null;
let currentDateKey = null;
let userLat = null;
let userLng = null;
let elevation = 0;
let azimuthKiblat = 0;
let currentHeading = 0;
let smoothHeading = 0;
let audioEnabled = true;
let notified = {};

const adzanSubuh = new Audio("audio/adzan_subuh.mp3");
const adzanNormal = new Audio("audio/adzan_normal.mp3");

const metodeSelect = document.getElementById("metode");
const jadwalList = document.getElementById("jadwalList");

/* ===============================
   REALTIME JAM & TANGGAL
================================= */

function updateClock() {
  const now = new Date();
  document.getElementById("jam").innerText =
    now.toLocaleTimeString("id-ID", { hour12: false });

  document.getElementById("tanggal").innerText =
    now.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
}
setInterval(updateClock, 1000);
updateClock();

/* ===============================
   INIT PRAYTIME v3.2
================================= */

let praytime;

const metodeList = {
  MWL: "Muslim World League",
  ISNA: "ISNA",
  Egypt: "Egypt",
  Makkah: "Umm Al-Qura (Default)",
  Karachi: "Karachi",
  Singapore: "Singapore"
};

function initMetode() {

  Object.keys(metodeList).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = metodeList[key];
    metodeSelect.appendChild(opt);
  });

  const saved = localStorage.getItem("metode") || "Makkah";
  metodeSelect.value = saved;

  praytime = new PrayTime(saved);

  metodeSelect.addEventListener("change", () => {
    localStorage.setItem("metode", metodeSelect.value);
    praytime = new PrayTime(metodeSelect.value);
    loadJadwal();
  });
}

initMetode();

/* ===============================
   GPS
================================= */

navigator.geolocation.getCurrentPosition(
  async pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;

    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - memuat elevasi...`;

    await getElevation();
    await reverseGeocode();
    hitungKiblat();
    loadJadwal();
  },
  err => {
    document.getElementById("namaLokasi").innerText =
      "❌ Izin lokasi ditolak / GPS tidak aktif";
  },
  {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0
  }
);

/* ===============================
   ELEVATION
================================= */

async function getElevation() {
  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${userLat},${userLng}`
    );
    const data = await res.json();
    elevation = data.results[0].elevation;

    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation} mdpl`;
  } catch (e) {
    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
  }
}

/* ===============================
   REVERSE GEOCODE (FIX FORMAT)
================================= */

async function reverseGeocode() {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`
    );
    const data = await res.json();

    const desa =
      data.address.village ||
      data.address.town ||
      data.address.city ||
      data.address.county ||
      "";

    const negara = data.address.country || "";

    // Formatter bersih tanpa koma ganda
    const lokasiParts = [];

    if (desa && desa.trim() !== "") lokasiParts.push(desa.trim());
    if (negara && negara.trim() !== "") lokasiParts.push(negara.trim());

    const lokasiFinal = lokasiParts.join(", ");

    // Halaman utama
    document.getElementById("namaLokasi").innerText =
      `📍 ${lokasiFinal}`;

    // Popup kompas (1 baris saja)
    document.getElementById("compassLokasi").innerText =
      lokasiFinal;

    document.getElementById("compassKoordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation} mdpl`;

  } catch (e) {
    document.getElementById("namaLokasi").innerText =
      "📍 Lokasi tidak ditemukan";
  }
}

/* ===============================
   FETCH JADWAL SHOLAT OTOMATIS
================================= */

async function fetchJadwalSholatAPI(lat, lng, method = 4) {
  try {
    const timestamp = Math.floor(new Date().getTime() / 1000);

    const res = await fetch(
      `https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lng}&method=${method}`
    );

    const json = await res.json();

    if (json.code !== 200) throw new Error("Failed fetch timetable");

    return json.data.timings;
  } catch (err) {
    console.error(err);
    return null;
  }
}

/* ===============================
   HITUNG JADWAL
================================= */

function loadJadwal() {
  if (!userLat || !userLng) return;

  const now = new Date();
  const todayKey = now.toDateString();

  // Jika sudah ganti hari → hitung ulang jadwal
  if (currentDateKey !== todayKey) {
    currentDateKey = todayKey;

    currentTimes = praytime
      .location([userLat, userLng])
      .timezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .getTimes(now);

    renderJadwal(currentTimes);
    startCountdown();
  }
}

/* ===============================
   RENDER JADWAL
================================= */

function renderJadwal(times) {

  jadwalList.innerHTML = "";

  Object.keys(namaSholatID).forEach(key => {
    const div = document.createElement("div");
    div.className = "jadwal-item";
    div.innerHTML = `
      <span>${labelSholat(key)}</span>
      <span>${times[key]}</span>
    `;
    jadwalList.appendChild(div);
  });
}

/* ===============================
   COUNTDOWN
================================= */

function startCountdown() {

  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(() => {

    if (!currentTimes) return;

    const now = new Date();
    const todayKey = now.toDateString();

    // Jika hari berganti → reload jadwal
    if (todayKey !== currentDateKey) {
      loadJadwal();
      return;
    }

    const urutan = ["fajr","sunrise","dhuhr","asr","maghrib","isha"];

    let nextName = null;
    let nextDate = null;

    for (let key of urutan) {

      const [h, m] = currentTimes[key].split(":").map(Number);

      const waktu = new Date();
      waktu.setHours(h, m, 0, 0);

      if (waktu > now) {
        nextName = key;
        nextDate = waktu;
        break;
      }
    }

    // Jika semua sudah lewat → Subuh besok
    if (!nextDate) {
      const [h, m] = currentTimes["fajr"].split(":").map(Number);

      nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 1);
      nextDate.setHours(h, m, 0, 0);

      nextName = "fajr";
    }

    const diffMs = nextDate - now;
    const totalDetik = Math.floor(diffMs / 1000);

    const jam = Math.floor(totalDetik / 3600);
    const menit = Math.floor((totalDetik % 3600) / 60);
    const detik = totalDetik % 60;

    let teksWaktu = "";

    if (jam > 0) {
      teksWaktu =
        `${jam} jam ` +
        `${menit.toString().padStart(2, "0")} menit ` +
        `${detik.toString().padStart(2, "0")} detik lagi`;
    } else {
      teksWaktu =
        `${menit.toString().padStart(2, "0")} menit ` +
        `${detik.toString().padStart(2, "0")} detik lagi`;
    }

    document.getElementById("menuju").innerText =
      totalDetik <= 1800
       ? `Sebentar lagi Waktu ${labelSholat(nextName)}`
       : `Menuju Waktu ${labelSholat(nextName)}`

    document.getElementById("countdown").innerText = teksWaktu;

    if (totalDetik === 0) {
      checkNotification(nextName, 0);
    }

  }, 1000);
}

/* ===============================
   NOTIFIKASI
================================= */

function checkNotification(name, diff) {
  if (diff === 0 && !notified[name]) {
    notified[name] = true;

    if (!audioEnabled) return;

    if (name === "fajr") {
      adzanSubuh.play();
    } else if (["sunrise"].includes(name)) {
      new Audio().play();
    } else {
      adzanNormal.play();
    }

    if (Notification.permission === "granted") {
      new Notification("Adzan Pro", {
        body: `Waktu ${labelSholat(name)} telah tiba`
      });
    }
  }
}

Notification.requestPermission();

/* ===============================
   TOGGLE AUDIO
================================= */

document.getElementById("toggleAudio").onclick = () => {
  audioEnabled = !audioEnabled;
  document.getElementById("toggleAudio").innerText =
    audioEnabled ? "🔔 Audio ON" : "🔕 Audio OFF";
};

/* ===============================
   HITUNG KIBLAT
================================= */

function hitungKiblat() {
  const dLon = (KAABAH.lng - userLng) * Math.PI / 180;
  const lat1 = userLat * Math.PI / 180;
  const lat2 = KAABAH.lat * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  azimuthKiblat = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;

  document.getElementById("azimuthKabah").innerText =
    `Azimuth Ka'bah : ${azimuthKiblat.toFixed(2)}°`;

  const jarak = haversine(userLat, userLng, KAABAH.lat, KAABAH.lng);
  document.getElementById("jarakKabah").innerText =
    `Jarak ke Ka'bah : ${jarak.toFixed(2)} Km`;
}

/* ===============================
   HAVERSINE
================================= */

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/* ===============================
   KOMPAS SMOOTH
================================= */

window.addEventListener("deviceorientation", e => {
  if (e.alpha === null) return;

  currentHeading = 360 - e.alpha;

  smoothHeading += (currentHeading - smoothHeading) * 0.1;

  document.getElementById("needle").style.transform =
    `translate(-50%, -100%) rotate(${smoothHeading}deg)`;

  document.getElementById("qiblatLine").style.transform =
    `translate(-50%, -100%) rotate(${azimuthKiblat}deg)`;

  const selisih =
    ((azimuthKiblat - smoothHeading + 540) % 360) - 180;

  document.getElementById("selisihSudut").innerText =
    `Selisih Sudut : ${Math.abs(selisih).toFixed(1)}°`;
});

/* ===============================
   OVERLAY
================================= */

document.getElementById("btnKiblat").onclick = () => {
  document.getElementById("overlay").style.display = "flex";
};

document.getElementById("closeCompass").onclick = () => {
  document.getElementById("overlay").style.display = "none";
};

/* ===============================
   MAPPING
================================= */

const namaSholatID = {
  fajr: "Subuh",
  sunrise: "Terbit",
  dhuhr: "Dzuhur",
  asr: "Ashar",
  maghrib: "Maghrib",
  isha: "Isya"
};

function labelSholat(key) {
  return namaSholatID[key] || key;
}

/* ===============================
   HELPER
================================= */

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
