/* ====================================================
   ADZAN PRO - FINAL PRODUCTION MERGE
   Trilingual + Vibration Qiblat
==================================================== */

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
let sudahGetar = false;

/* ==========================
   🌍 SISTEM BAHASA
========================== */

let currentLang = localStorage.getItem("lang") || "id";

const TEXT = {
  id:{
    prayer:{
      fajr:"Subuh",
      sunrise:"Terbit",
      dhuhr:"Dzuhur",
      asr:"Ashar",
      maghrib:"Maghrib",
      isha:"Isya"
    },
    menuju:"Menuju Waktu",
    sebentar:"Sebentar lagi Waktu",
    jam:"jam",
    menit:"menit",
    detik:"detik",
    lagi:"lagi",
    alert:"sebentar lagi",
    tiba:"telah tiba",
    arah:["Utara","Timur Laut","Timur","Tenggara","Selatan","Barat Daya","Barat","Barat Laut"]
  },
  en:{
    prayer:{
      fajr:"Fajr",
      sunrise:"Sunrise",
      dhuhr:"Dhuhr",
      asr:"Asr",
      maghrib:"Maghrib",
      isha:"Isha"
    },
    menuju:"Next Prayer",
    sebentar:"Prayer Time Soon",
    jam:"hours",
    menit:"minutes",
    detik:"seconds",
    lagi:"left",
    alert:"coming soon",
    tiba:"has begun",
    arah:["North","North East","East","South East","South","South West","West","North West"]
  },
  ar:{
    prayer:{
      fajr:"الفجر",
      sunrise:"الشروق",
      dhuhr:"الظهر",
      asr:"العصر",
      maghrib:"المغرب",
      isha:"العشاء"
    },
    menuju:"الصلاة القادمة",
    sebentar:"حان وقت الصلاة",
    jam:"ساعة",
    menit:"دقيقة",
    detik:"ثانية",
    lagi:"متبقي",
    alert:"قريباً",
    tiba:"حان الآن",
    arah:["الشمال","شمال شرق","الشرق","جنوب شرق","الجنوب","جنوب غرب","الغرب","شمال غرب"]
  }
};

function labelSholat(key){
  return TEXT[currentLang].prayer[key] || key;
}

/* ==========================
   📅 TANGGAL SAJA (JAM DIHAPUS)
========================== */

function updateTanggal() {
  const now = new Date();
  document.getElementById("tanggal").innerText =
    now.toLocaleDateString(
      currentLang==="id"?"id-ID":
      currentLang==="en"?"en-US":"ar-SA",
      { weekday:"long", day:"numeric", month:"long", year:"numeric" }
    );
}
setInterval(updateTanggal, 60000);
updateTanggal();

/* ============================
   METODE HISAB
============================ */

let praytime;
const metodeSelect = document.getElementById("metode");
const jadwalList = document.getElementById("jadwalList");

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
    loadJadwal();
  });
}
initMetode();

/* ==========================
   GPS
========================== */

navigator.geolocation.getCurrentPosition(
  async pos => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    hitungKiblat();
    loadJadwal();
  },
  err => {
    document.getElementById("namaLokasi").innerText =
      "❌ Izin lokasi ditolak / GPS tidak aktif";
  },
  { enableHighAccuracy:true }
);

/* ===============================
   TAMPILKAN JADWAL
================================= */

const urutanSholat = ["fajr","sunrise","dhuhr","asr","maghrib","isha"];

function tampilkanJadwal(times){
  jadwalList.innerHTML = "";
  urutanSholat.forEach(key => {
    const div = document.createElement("div");
    div.className = "jadwal-item";
    const jam = times[key]?.substring(0,5) || "--:--";
    div.innerHTML = `<span>${labelSholat(key)}</span><span>${jam}</span>`;
    jadwalList.appendChild(div);
  });
}

/* ===============================
   LOAD JADWAL
================================= */

async function loadJadwal(){
  if(!userLat || !userLng) return;

  const now = new Date();
  const todayKey = now.toDateString();
  if(currentDateKey === todayKey && currentTimes) return;

  currentDateKey = todayKey;
  notified = {};

  try {
    const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${userLat}&longitude=${userLng}&method=20`);
    const json = await res.json();
    const t = json.data.timings;

    currentTimes = {
      fajr:t.Fajr.substring(0,5),
      sunrise:t.Sunrise.substring(0,5),
      dhuhr:t.Dhuhr.substring(0,5),
      asr:t.Asr.substring(0,5),
      maghrib:t.Maghrib.substring(0,5),
      isha:t.Isha.substring(0,5)
    };

  } catch {
    const offline = praytime.location([userLat,userLng])
      .timezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .getTimes(now);

    currentTimes = offline;
  }

  tampilkanJadwal(currentTimes);
  startCountdown();
}

/* ============================
   COUNTDOWN MULTI BAHASA
============================ */

function startCountdown(){
  if(countdownInterval) clearInterval(countdownInterval);

  countdownInterval = setInterval(()=>{
    if(!currentTimes) return;

    const now = new Date();
    let nextName=null, nextDate=null;

    for(let key of urutanSholat){
      const [h,m]=currentTimes[key].split(":").map(Number);
      const waktu=new Date();
      waktu.setHours(h,m,0,0);
      if(waktu>now){ nextName=key; nextDate=waktu; break; }
    }

    if(!nextDate){
      const [h,m]=currentTimes["fajr"].split(":").map(Number);
      nextDate=new Date(); nextDate.setDate(nextDate.getDate()+1);
      nextDate.setHours(h,m,0,0);
      nextName="fajr";
    }

    const diff=Math.floor((nextDate-now)/1000);
    const jam=Math.floor(diff/3600);
    const menit=Math.floor((diff%3600)/60);
    const detik=diff%60;

    let teks=
      jam>0
      ? `${jam} ${TEXT[currentLang].jam} ${menit} ${TEXT[currentLang].menit} ${detik} ${TEXT[currentLang].detik} ${TEXT[currentLang].lagi}`
      : `${menit} ${TEXT[currentLang].menit} ${detik} ${TEXT[currentLang].detik} ${TEXT[currentLang].lagi}`;

    document.getElementById("menuju").innerText =
      diff<=1800
      ? `${TEXT[currentLang].sebentar} ${labelSholat(nextName)}`
      : `${TEXT[currentLang].menuju} ${labelSholat(nextName)}`;

    document.getElementById("countdown").innerText = teks;

    if(diff===0) checkNotification(nextName);
  },1000);
}

/* ======================
   NOTIFIKASI
====================== */

const adzanSubuh = new Audio("audio/adzan_subuh.mp3");
const adzanNormal = new Audio("audio/adzan_normal.mp3");

function checkNotification(name){
  if(!notified[name]){
    notified[name]=true;
    if(audioEnabled){
      name==="fajr"?adzanSubuh.play():adzanNormal.play();
    }
    if(Notification.permission==="granted"){
      new Notification("Adzan Pro",{body:`${labelSholat(name)} ${TEXT[currentLang].tiba}`});
    }
  }
}
Notification.requestPermission();

/* ===============================
   KIBLAT + GETAR
================================= */

function hitungKiblat(){
  const dLon=(KAABAH.lng-userLng)*Math.PI/180;
  const lat1=userLat*Math.PI/180;
  const lat2=KAABAH.lat*Math.PI/180;
  const y=Math.sin(dLon)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  azimuthKiblat=(Math.atan2(y,x)*180/Math.PI+360)%360;
}

window.addEventListener("deviceorientation", e=>{
  if(e.alpha===null) return;

  currentHeading=360-e.alpha;
  smoothHeading+=(currentHeading-smoothHeading)*0.1;

  document.getElementById("compassDisk").style.transform=`rotate(${-smoothHeading}deg)`;
  document.getElementById("qiblatLine").style.transform=
    `translate(-50%,-100%) rotate(${azimuthKiblat-smoothHeading}deg)`;

  const selisih=((azimuthKiblat-smoothHeading+540)%360)-180;

  if(Math.abs(selisih)<=3){
    if(!sudahGetar && navigator.vibrate){
      navigator.vibrate(300);
      sudahGetar=true;
    }
  } else {
    sudahGetar=false;
  }

  const index=Math.round(smoothHeading/45)%8;
  document.getElementById("arahMataAngin").innerText =
    TEXT[currentLang].arah[index];
});

/* ==================
   OVERLAY
================== */

document.getElementById("btnKiblat").onclick=()=>{
  document.getElementById("overlay").style.display="flex";
};
document.getElementById("closeCompass").onclick=()=>{
  document.getElementById("overlay").style.display="none";
};
