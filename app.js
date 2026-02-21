/* ===================================================
   ADZAN PRO - FINAL OPTIMIZED PRODUCTION
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
let orientationRunning = false;

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
    now.toLocaleTimeString("id-ID", { hour12:false });
  document.getElementById("tanggal").innerText =
    now.toLocaleDateString("id-ID", {
      weekday:"long",
      day:"numeric",
      month:"long",
      year:"numeric"
    });
}
setInterval(updateClock, 1000);
updateClock();

/* ===============================
   INIT METODE
================================= */
let praytime;

const metodeList = {
  MWL:"Muslim World League",
  ISNA:"ISNA",
  Egypt:"Egypt",
  Makkah:"Umm Al-Qura",
  Karachi:"Karachi",
  Singapore:"Singapore",
  Kemenag:"Kemenag / MABIMS"
};

function initMetode() {
  Object.keys(metodeList).forEach(key => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = metodeList[key];
    metodeSelect.appendChild(opt);
  });

  const saved = localStorage.getItem("metode") || "Kemenag";
  metodeSelect.value = saved;
  praytime = new PrayTime(saved);

  metodeSelect.addEventListener("change", () => {
    localStorage.setItem("metode", metodeSelect.value);
    praytime = new PrayTime(metodeSelect.value);
    loadJadwal(true);
  });
}
initMetode();

/* ===============================
   GPS & ELEVATION (PARALLEL)
================================= */
navigator.geolocation.getCurrentPosition(
  async pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;

    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - memuat...`;

    await Promise.all([
      getElevation(),
      reverseGeocode()
    ]);

    hitungKiblat();
    loadJadwal();
  },
  err => {
    document.getElementById("namaLokasi").innerText =
      "❌ Izin lokasi ditolak / GPS tidak aktif";
  },
  { enableHighAccuracy:true, timeout:15000, maximumAge:0 }
);

async function getElevation() {
  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${userLat},${userLng}`
    );
    const data = await res.json();
    elevation = data.results[0].elevation;
  } catch(e){}
}

async function reverseGeocode() {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`
    );
    const data = await res.json();
    const desa = data.address.village ||
                 data.address.town ||
                 data.address.city ||
                 data.address.county || "";
    const negara = data.address.country || "";

    const lokasiFinal = [desa, negara]
      .filter(v => v && v.trim() !== "")
      .join(", ");

    document.getElementById("namaLokasi").innerText =
      `📍 ${lokasiFinal}`;

    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation.toFixed(2)} mdpl`;

    document.getElementById("compassLokasi").innerText = lokasiFinal;
    document.getElementById("compassKoordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation.toFixed(2)} mdpl`;
  } catch(e){}
}

/* ===============================
   LOAD JADWAL (INSTANT + CACHE)
================================= */
const namaSholatID = {
  fajr:"Subuh",
  sunrise:"Terbit",
  dhuhr:"Dzuhur",
  asr:"Ashar",
  maghrib:"Maghrib",
  isha:"Isya"
};

function tampilkanJadwal(times){
  jadwalList.innerHTML="";
  Object.keys(namaSholatID).forEach(key=>{
    const div=document.createElement("div");
    div.className="jadwal-item";
    div.innerHTML=`
      <span>${namaSholatID[key]}</span>
      <span>${times[key]?.substring(0,5) || "--:--"}</span>
    `;
    jadwalList.appendChild(div);
  });
}

async function loadJadwal(force=false){
  if(!userLat || !userLng) return;

  const now = new Date();
  const todayKey = now.toDateString();

  if(!force && currentDateKey === todayKey && currentTimes) return;

  currentDateKey = todayKey;
  notified = {};

  // 🔥 CACHE
  const cache = JSON.parse(localStorage.getItem("jadwalCache") || "{}");
  if(cache.date === todayKey){
    currentTimes = cache.times;
    tampilkanJadwal(currentTimes);
    startCountdown();
  }

  // 🔥 INSTANT OFFLINE CALCULATION
  currentTimes = praytime
    .location([userLat,userLng])
    .timezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    .getTimes(now);

  tampilkanJadwal(currentTimes);
  startCountdown();

  // 🔄 UPDATE BACKGROUND API
  try{
    const metodeValue = localStorage.getItem("metode") || "Kemenag";
    const aladhanMethod = {
      MWL:3, ISNA:2, Egypt:5, Makkah:4,
      Karachi:1, Singapore:7, Kemenag:20
    }[metodeValue] || 20;

    const res = await fetch(
      `https://api.aladhan.com/v1/timings?latitude=${userLat}&longitude=${userLng}&method=${aladhanMethod}`
    );
    const json = await res.json();
    const apiTimes = json.data.timings;

    currentTimes = {
      fajr:apiTimes.Fajr.substring(0,5),
      sunrise:apiTimes.Sunrise.substring(0,5),
      dhuhr:apiTimes.Dhuhr.substring(0,5),
      asr:apiTimes.Asr.substring(0,5),
      maghrib:apiTimes.Maghrib.substring(0,5),
      isha:apiTimes.Isha.substring(0,5)
    };

    tampilkanJadwal(currentTimes);

    localStorage.setItem("jadwalCache", JSON.stringify({
      date: todayKey,
      times: currentTimes
    }));

  } catch(e){}
}

/* ===============================
   COUNTDOWN
================================= */
function startCountdown(){
  if(countdownInterval) clearInterval(countdownInterval);

  countdownInterval=setInterval(()=>{
    if(!currentTimes) return;

    const now=new Date();
    const urutan=["fajr","sunrise","dhuhr","asr","maghrib","isha"];

    let nextName=null,nextDate=null;

    for(let key of urutan){
      const [h,m]=currentTimes[key].split(":").map(Number);
      const waktu=new Date();
      waktu.setHours(h,m,0,0);
      if(waktu>now){ nextName=key; nextDate=waktu; break; }
    }

    if(!nextDate){
      const [h,m]=currentTimes["fajr"].split(":").map(Number);
      nextDate=new Date();
      nextDate.setDate(nextDate.getDate()+1);
      nextDate.setHours(h,m,0,0);
      nextName="fajr";
    }

    const diff=Math.floor((nextDate-now)/1000);
    const jam=Math.floor(diff/3600);
    const menit=Math.floor((diff%3600)/60);
    const detik=diff%60;

    document.getElementById("menuju").innerText =
      `Menuju Waktu ${namaSholatID[nextName]}`;

    document.getElementById("countdown").innerText =
      `${jam>0?jam+" jam ":""}${menit.toString().padStart(2,"0")} menit ${detik.toString().padStart(2,"0")} detik lagi`;

  },1000);
}

/* ===============================
   KOMPAS OPTIMIZED
================================= */
window.addEventListener("deviceorientation", e=>{
  if(e.alpha===null) return;
  currentHeading = 360 - e.alpha;

  if(!orientationRunning){
    orientationRunning = true;
    requestAnimationFrame(updateCompass);
  }
});

function updateCompass(){
  smoothHeading += (currentHeading - smoothHeading)*0.1;

  document.getElementById("compassDisk").style.transform =
    `rotate(${-smoothHeading}deg)`;

  document.getElementById("qiblatLine").style.transform =
    `translate(-50%, -100%) rotate(${azimuthKiblat - smoothHeading}deg)`;

  orientationRunning = false;
}
