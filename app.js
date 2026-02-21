/* ===================================================
   ADZAN PRO - FINAL FULL OPTIMIZED VERSION
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
   GPS & LOKASI (PARALLEL API)
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

    document.getElementById("namaLokasi").innerText = `📍 ${lokasiFinal}`;
    document.getElementById("compassLokasi").innerText = lokasiFinal;

    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation.toFixed(2)} mdpl`;

    document.getElementById("compassKoordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation.toFixed(2)} mdpl`;

  } catch(e){}
}

/* ===============================
   HITUNG KIBLAT
================================= */
function hitungKiblat(){
  const dLon=(KAABAH.lng-userLng)*Math.PI/180;
  const lat1=userLat*Math.PI/180;
  const lat2=KAABAH.lat*Math.PI/180;

  const y=Math.sin(dLon)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2) -
          Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);

  azimuthKiblat=(Math.atan2(y,x)*180/Math.PI+360)%360;

  document.getElementById("azimuthKabah").innerText =
    `Azimuth Ka'bah : ${azimuthKiblat.toFixed(2)}°`;

  const jarak = haversine(userLat,userLng,KAABAH.lat,KAABAH.lng);

  document.getElementById("jarakKabah").innerText =
    `Jarak ke Ka'bah : ${jarak.toFixed(2)} Km`;
}

function haversine(lat1,lon1,lat2,lon2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLon=(lon2-lon1)*Math.PI/180;

  const a=Math.sin(dLat/2)**2 +
           Math.cos(lat1*Math.PI/180) *
           Math.cos(lat2*Math.PI/180) *
           Math.sin(dLon/2)**2;

  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

/* ===============================
   JADWAL SHOLAT
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

  const now=new Date();
  const todayKey=now.toDateString();

  if(!force && currentDateKey===todayKey && currentTimes) return;

  currentDateKey=todayKey;
  notified={};

  // OFFLINE INSTANT
  currentTimes = praytime
    .location([userLat,userLng])
    .timezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    .getTimes(now);

  tampilkanJadwal(currentTimes);
  startCountdown();
}

/* ===============================
   COUNTDOWN + ALERT
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

    checkNearPrayer();
    if(diff===0) checkNotification(nextName);
  },1000);
}

/* ===============================
   ALERT 10 MENIT
================================= */
function checkNearPrayer(){
  const now=new Date();
  const currentMinutes=now.getHours()*60+now.getMinutes();
  const alertText=document.getElementById("prayerAlert");

  let found=false;

  for(let key in currentTimes){
    const [h,m]=currentTimes[key].split(":").map(Number);
    const prayerMinutes=h*60+m;
    const diff=prayerMinutes-currentMinutes;

    if(diff>0 && diff<=10){
      alertText.textContent =
        `⏰ ${namaSholatID[key]} sebentar lagi (${currentTimes[key]})`;
      alertText.classList.add("blink-text");
      found=true;
      break;
    }
  }

  if(!found){
    alertText.textContent="";
    alertText.classList.remove("blink-text");
  }
}

/* ===============================
   NOTIFIKASI
================================= */
function checkNotification(name){
  if(notified[name]) return;

  notified[name]=true;

  if(audioEnabled){
    if(name==="fajr") adzanSubuh.play();
    else adzanNormal.play();
  }

  if(Notification.permission==="granted"){
    new Notification("Adzan Pro",{
      body:`Waktu ${namaSholatID[name]} telah tiba`
    });
  }
}
Notification.requestPermission();

/* ===============================
   TOGGLE AUDIO
================================= */
document.getElementById("toggleAudio").onclick=()=>{
  audioEnabled=!audioEnabled;
  document.getElementById("toggleAudio").innerText=
    audioEnabled?"🔔 Audio ON":"🔕 Audio OFF";
};

/* ===============================
   KOMPAS 360° + SMOOTH
================================= */

const arahMataAnginLabel =
["Utara","Timur Laut","Timur","Tenggara",
 "Selatan","Barat Daya","Barat","Barat Laut"];

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

  const selisih = ((azimuthKiblat - smoothHeading + 540)%360)-180;

  document.getElementById("selisihSudut").innerText =
    `Selisih Sudut : ${Math.abs(selisih).toFixed(1)}°`;

  const index = Math.round(smoothHeading / 45) % 8;

  document.getElementById("arahMataAngin").innerText =
    `Arah Mata Angin : ${arahMataAnginLabel[index]}`;

  orientationRunning=false;
}

/* ===============================
   OVERLAY
================================= */
document.getElementById("btnKiblat").onclick=()=>{
  document.getElementById("overlay").style.display="flex";
};
document.getElementById("closeCompass").onclick=()=>{
  document.getElementById("overlay").style.display="none";
};
