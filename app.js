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
    now.toLocaleTimeString("id-ID", { hour12:false });
  document.getElementById("tanggal").innerText =
    now.toLocaleDateString("id-ID", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
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
    loadJadwal();
  });
}
initMetode();
/* ===============================
   GPS & ELEVATION
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
  err => { document.getElementById("namaLokasi").innerText = "❌ Izin lokasi ditolak / GPS tidak aktif"; },
  { enableHighAccuracy:true, timeout:15000, maximumAge:0 }
);
async function getElevation() {
  try {
    const res = await fetch(`https://api.open-elevation.com/api/v1/lookup?locations=${userLat},${userLng}`);
    const data = await res.json();
    elevation = data.results[0].elevation;
    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation.toFixed(2)} mdpl`;
  } catch(e) {
    document.getElementById("koordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)}`;
  }
}
async function reverseGeocode() {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLat}&lon=${userLng}`);
    const data = await res.json();
    const desa = data.address.village||data.address.town||data.address.city||data.address.county||"";
    const negara = data.address.country||"";
    const lokasiParts=[];
    if(desa && desa.trim()!=="") lokasiParts.push(desa.trim());
    if(negara && negara.trim()!=="") lokasiParts.push(negara.trim());
    const lokasiFinal = lokasiParts.join(", ");
    document.getElementById("namaLokasi").innerText = `📍 ${lokasiFinal}`;
    document.getElementById("compassLokasi").innerText = lokasiFinal;
    document.getElementById("compassKoordinat").innerText =
      `${userLat.toFixed(6)}, ${userLng.toFixed(6)} - ${elevation.toFixed(2)} mdpl`;
  } catch(e){ document.getElementById("namaLokasi").innerText = "📍 Silakan refresh halaman..."; }
}
/* ===============================
   FETCH JADWAL SHOLAT OTOMATIS
================================= */
async function fetchJadwalSholatAPI(lat,lng,method=9) {
  try {
    const timestamp = Math.floor(new Date().getTime()/1000);
    const res = await fetch(`https://api.aladhan.com/v1/timings/${timestamp}?latitude=${lat}&longitude=${lng}&method=${method}`);
    const json = await res.json();
    if(json.code!==200) throw new Error("Failed fetch timetable");
    return json.data.timings;
  } catch(err){ console.error(err); return null; }
}
/* ===============================
   HITUNG & RENDER JADWAL
================================= */
const namaSholatID = { fajr:"Subuh", sunrise:"Terbit", dhuhr:"Dzuhur", asr:"Ashar", maghrib:"Maghrib", isha:"Isya"};
function labelSholat(key){ return namaSholatID[key]||key; }
/* ===============================
   TAMPILKAN JADWAL (REVISI)
================================= */
function tampilkanJadwal(times){
  jadwalList.innerHTML="";
  Object.keys(namaSholatID).forEach(key=>{
    const div=document.createElement("div");
    div.className="jadwal-item";
    const jam = times[key]?.substring(0,5) || "--:--";
    div.innerHTML=`
      <span>${labelSholat(key)}</span>
      <span>${jam}</span>
    `;
    jadwalList.appendChild(div);
  });
}
/* ===============================
   LOAD JADWAL FINAL STABIL
   Default Kemenag = Method 20
================================= */
async function loadJadwal(){
  if(!userLat || !userLng) return;
  const now=new Date();
  const todayKey=now.toDateString();
  if(currentDateKey===todayKey && currentTimes) return;
  currentDateKey=todayKey;
  notified={};
  const metodeValue=localStorage.getItem("metode")||"Kemenag";
  const aladhanMethod={
    MWL:3,
    ISNA:2,
    Egypt:5,
    Makkah:4,
    Karachi:1,
    Singapore:7,
    Kemenag:20   // 🔥 RESMI KEMENAG RI
  }[metodeValue]||20;
  try{
    const res = await fetch(
      `https://api.aladhan.com/v1/timings?latitude=${userLat}&longitude=${userLng}&method=${aladhanMethod}`
    );
    if(!res.ok) throw new Error("Network error");
    const json = await res.json();
    if(json.code!==200) throw new Error("API error");
    const apiTimes = json.data.timings;
    currentTimes={
      fajr:apiTimes.Fajr.substring(0,5),
      sunrise:apiTimes.Sunrise.substring(0,5),
      dhuhr:apiTimes.Dhuhr.substring(0,5),
      asr:apiTimes.Asr.substring(0,5),
      maghrib:apiTimes.Maghrib.substring(0,5),
      isha:apiTimes.Isha.substring(0,5)
    };
  }catch(err){
    console.warn("API gagal, fallback ke PrayTime",err);
    // 🔄 FALLBACK ke PrayTime (offline calculation)
    currentTimes = praytime
      .location([userLat,userLng])
      .timezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      .getTimes(now);
  }
  tampilkanJadwal(currentTimes);
  startCountdown();
}
/* ===============================
   COUNTDOWN & ALERT BERKEDIP
================================= */
function startCountdown(){
  if(countdownInterval) clearInterval(countdownInterval);
  countdownInterval=setInterval(()=>{
    if(!currentTimes) return;
    const now=new Date();
    const todayKey=now.toDateString();
    if(todayKey!==currentDateKey){ loadJadwal(); return; }
    const urutan=["fajr","sunrise","dhuhr","asr","maghrib","isha"];
    let nextName=null, nextDate=null;
    for(let key of urutan){
      const [h,m]=currentTimes[key].split(":").map(Number);
      const waktu=new Date();
      waktu.setHours(h,m,0,0);
      if(waktu>now){ nextName=key; nextDate=waktu; break; }
    }
    if(!nextDate){
      const [h,m]=currentTimes["fajr"].split(":").map(Number);
      nextDate=new Date(); nextDate.setDate(nextDate.getDate()+1);
      nextDate.setHours(h,m,0,0); nextName="fajr";
    }
    const diffMs=nextDate-now;
    const totalDetik=Math.floor(diffMs/1000);
    const jam=Math.floor(totalDetik/3600);
    const menit=Math.floor((totalDetik%3600)/60);
    const detik=totalDetik%60;
    let teksWaktu=jam>0?`${jam} jam ${menit.toString().padStart(2,"0")} menit ${detik.toString().padStart(2,"0")} detik lagi`
      :`${menit.toString().padStart(2,"0")} menit ${detik.toString().padStart(2,"0")} detik lagi`;
    document.getElementById("menuju").innerText=totalDetik<=1800?`Sebentar lagi Waktu ${labelSholat(nextName)}`:`Menuju Waktu ${labelSholat(nextName)}`;
    document.getElementById("countdown").innerText=teksWaktu;
    checkNearPrayer();
    if(totalDetik===0) checkNotification(nextName,0);
  },1000);
}
/* ===============================
   ALERT BERKEDIP 10 MENIT SEBELUM SHOLAT
================================= */
function checkNearPrayer(){
  if(!currentTimes) return;
  const now=new Date();
  const currentMinutes=now.getHours()*60+now.getMinutes();
  const alertText=document.getElementById("prayerAlert");
  let found=false;
  for(let key in currentTimes){
    const [h,m]=currentTimes[key].split(":").map(Number);
    const prayerMinutes=h*60+m;
    const diff=prayerMinutes-currentMinutes;
    if(diff>0&&diff<=10){
      alertText.textContent=`⏰ ${labelSholat(key)} sebentar lagi (${currentTimes[key]})`;
      alertText.classList.add("blink-text");
      found=true;
      break;
    }
  }
  if(!found){ alertText.textContent=""; alertText.classList.remove("blink-text"); }
}
setInterval(checkNearPrayer,30000);
checkNearPrayer();
/* ===============================
   NOTIFIKASI
================================= */
function checkNotification(name,diff){
  if(diff===0&&!notified[name]){
    notified[name]=true;
    if(!audioEnabled) return;
    if(name==="fajr") adzanSubuh.play();
    else if(["sunrise"].includes(name)) new Audio().play();
    else adzanNormal.play();
    if(Notification.permission==="granted"){
      new Notification("Adzan Pro",{body:`Waktu ${labelSholat(name)} telah tiba`});
    }
  }
}
Notification.requestPermission();
/* ===============================
   TOGGLE AUDIO
================================= */
document.getElementById("toggleAudio").onclick=()=>{
  audioEnabled=!audioEnabled;
  document.getElementById("toggleAudio").innerText=audioEnabled?"🔔 Audio ON":"🔕 Audio OFF";
};
/* ===============================
   HITUNG KIBLAT
================================= */
function hitungKiblat(){
  const dLon=(KAABAH.lng-userLng)*Math.PI/180;
  const lat1=userLat*Math.PI/180;
  const lat2=KAABAH.lat*Math.PI/180;
  const y=Math.sin(dLon)*Math.cos(lat2);
  const x=Math.cos(lat1)*Math.sin(lat2)-Math.sin(lat1)*Math.cos(lat2)*Math.cos(dLon);
  azimuthKiblat=(Math.atan2(y,x)*180/Math.PI+360)%360;
  document.getElementById("azimuthKabah").innerText=`Azimuth Ka'bah : ${azimuthKiblat.toFixed(2)}°`;
  const jarak = haversine(userLat,userLng,KAABAH.lat,KAABAH.lng);
  document.getElementById("jarakKabah").innerText=`Jarak ke Ka'bah : ${jarak.toFixed(2)} Km`;
}
function haversine(lat1,lon1,lat2,lon2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
/* ===============================
   KOMPAS & ARAH MATA ANGIN
================================= */
// Label arah lengkap untuk teks bawah koordinat
const arahMataAnginLabel = ["Utara","Timur Laut","Timur","Tenggara","Selatan","Barat Daya","Barat","Barat Laut"];
// Label singkat untuk piringan kompas
const arahMataAnginSingkat = ["N","NE","E","SE","S","SW","W","NW"];
// Buat label piringan kompas
const directionLabelsContainer = document.getElementById("directionLabels");
function buatLabelPiringan() {
  arahMataAnginSingkat.forEach((label, index) => {
    const div = document.createElement("div");
    div.className = "direction-label";
    div.innerText = label;
    const angle = (index * 360 / arahMataAnginSingkat.length) * Math.PI / 180;
    const x = 50 + Math.sin(angle) * 50;
    const y = 50 - Math.cos(angle) * 50;
    div.style.left = `${x}%`;
    div.style.top = `${y}%`;
    directionLabelsContainer.appendChild(div);
  });
}
buatLabelPiringan();
/* ===============================
   GENERATE TICK KOMPAS 360°
================================= */
function createCompassTicks(){
  const container = document.getElementById("ticks");
  if(!container) return;
  container.innerHTML = "";
  for(let i=0; i<360; i+=5){
    const tick = document.createElement("div");
    tick.classList.add("tick");
    if(i % 30 === 0){
      tick.classList.add("large");
    }
    else if(i % 10 === 0){
      tick.classList.add("medium");
    }
    else{
      tick.classList.add("small");
    }
    if(i === 0){
      tick.classList.add("north");
    }
    tick.style.transform = `rotate(${i}deg)`;
    container.appendChild(tick);
  }
}
createCompassTicks();
// Event device orientation
window.addEventListener("deviceorientation", e=>{
  if(e.alpha===null) return;
  currentHeading = 360 - e.alpha;
  smoothHeading += (currentHeading - smoothHeading)*0.1;
  // Putar piringan berlawanan arah hadap HP
document.getElementById("compassDisk").style.transform =
  `rotate(${-smoothHeading}deg)`;
// Garis kiblat relatif terhadap arah HP
document.getElementById("qiblatLine").style.transform =
  `translate(-50%, -100%) rotate(${azimuthKiblat - smoothHeading}deg)`;
  const selisih = ((azimuthKiblat - smoothHeading + 540)%360)-180;
  document.getElementById("selisihSudut").innerText=
    `Selisih Sudut : ${Math.abs(selisih).toFixed(1)}°`;
  // Update arah lengkap di bawah koordinat
  const index = Math.round(smoothHeading / 45) % 8;
  document.getElementById("arahMataAngin").innerText=
    `Arah Mata Angin : ${arahMataAnginLabel[index]}`;
});
/* ===============================
   OVERLAY KOMPAS
================================= */
document.getElementById("btnKiblat").onclick=()=>{
  document.getElementById("overlay").style.display="flex";
};
document.getElementById("closeCompass").onclick=()=>{
  document.getElementById("overlay").style.display="none";
};
