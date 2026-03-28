// ─── STATE ───
const data = {};
let currentStep = 1;
const totalSteps = 3;
let isFlipped = false;
let isSubmitting = false;

// ─── LOADER ───
const loaderLines = [
  'Welcome…',
  'We are glad you came…',
  'Preparing your worship experience…'
];

function typeText(el, text, cb) {
  el.textContent = '';
  let i = 0;
  const t = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) { clearInterval(t); setTimeout(cb || (()=>{}), 400); }
  }, 50);
}

(function runLoader() {
  const el = document.getElementById('loaderText');
  let idx = 0;
  function next() {
    if (idx >= loaderLines.length) {
      setTimeout(() => showScreen('screen-landing'), 600);
      return;
    }
    typeText(el, loaderLines[idx++], () => setTimeout(next, 300));
  }
  setTimeout(next, 600);
})();

// ─── SCREEN MANAGEMENT ───
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
}

// ─── LANDING ───
function startRegistration() {
  showScreen('screen-form');
  updateFormUI();
}

// ─── FORM STEPS ───
const stepTitles = ['Personal Information', 'Contact & Details', 'Ministry & Background'];

function updateFormUI() {
  document.getElementById('formStepLabel').textContent = `Step ${currentStep} of ${totalSteps}`;
  document.getElementById('formStepTitle').textContent = stepTitles[currentStep-1];

  document.querySelectorAll('.form-step').forEach((s,i) => {
    s.classList.toggle('active', i+1 === currentStep);
  });

  // Progress
  [1,2,3].forEach(i => {
    const ps = document.getElementById('pstep'+i);
    ps.classList.remove('active','done');
    if (i < currentStep) ps.classList.add('done');
    else if (i === currentStep) ps.classList.add('active');

    const circle = ps.querySelector('.progress-circle');
    circle.textContent = i < currentStep ? '✓' : i;
  });
  [1,2].forEach(i => {
    const pl = document.getElementById('pline'+i);
    pl.classList.toggle('done', i < currentStep);
  });

  document.getElementById('btnPrev').classList.toggle('hidden', currentStep === 1);
  document.getElementById('btnNext').textContent = currentStep === totalSteps ? 'Proceed to Photo' : 'Next';
  const arrow = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  document.getElementById('btnNext').innerHTML = (currentStep === totalSteps ? 'Proceed to Photo ' : 'Next ') + arrow;
}

function nextStep() {
  if (!validateStep()) return;
  collectData();
  if (currentStep < totalSteps) {
    currentStep++;
    updateFormUI();
    window.scrollTo(0,0);
  } else {
    // Go to camera
    showScreen('screen-camera');
    startCamera();
  }
}

function prevStep() {
  if (currentStep > 1) { currentStep--; updateFormUI(); window.scrollTo(0,0); }
}

function validateStep() {
  let ok = true;
  if (currentStep === 1) {
    const name = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    document.getElementById('fg-name').classList.toggle('error', !name);
    if (!name) ok = false;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    document.getElementById('fg-email').classList.toggle('error', !emailOk);
    if (!emailOk) ok = false;
  }
  return ok;
}

function collectData() {
  if (currentStep === 1) {
    data.fullName = document.getElementById('fullName').value.trim();
    data.email = document.getElementById('email').value.trim();
  }
  if (currentStep === 2) {
    data.phone = document.getElementById('phone').value.trim();
    data.dob = document.getElementById('dob').value;
    data.age = document.getElementById('ageDisplay').textContent;
    data.gender = document.getElementById('gender').value;
    data.address = document.getElementById('address').value.trim();
  }
  if (currentStep === 3) {
    data.department = document.getElementById('department').value || 'None for now';
    data.marital = document.getElementById('marital').value || '—';
    data.stateOrigin = document.getElementById('stateOrigin').value || '—';
    data.nationality = document.getElementById('nationality').value;
    data.occupation = document.getElementById('occupation').value.trim() || '—';
    data.firstTime = data.firstTime || 'No';
    data.inviter = document.getElementById('inviter').value.trim();
    data.whyJoined = document.getElementById('whyJoined').value.trim();
    data.prayerRequest = document.getElementById('prayerRequest').value.trim();
    data.nokName = document.getElementById('nokName').value.trim() || '—';
    data.nokPhone = document.getElementById('nokPhone').value.trim() || '—';
  }
}

// ─── GREETING ───
function updateGreeting() {
  const name = document.getElementById('fullName').value.trim();
  const banner = document.getElementById('greetingBanner');
  const gn = document.getElementById('greetingName');
  if (name.length > 1) {
    const first = name.split(' ')[0];
    gn.textContent = first;
    banner.classList.add('visible');
  } else {
    banner.classList.remove('visible');
  }
}

// ─── PHONE FORMAT ───
function formatPhone(el) {
  let v = el.value.replace(/\D/g,'');
  if (v.startsWith('0')) v = v.slice(0,11);
  else v = v.slice(0,10);
  let f = '';
  if (v.length <= 4) f = v;
  else if (v.length <= 7) f = v.slice(0,4)+' '+v.slice(4);
  else f = v.slice(0,4)+' '+v.slice(4,7)+' '+v.slice(7);
  el.value = f;
}

// ─── AGE CALC ───
function calcAge() {
  const dob = document.getElementById('dob').value;
  if (!dob) return;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  const el = document.getElementById('ageDisplay');
  el.textContent = `Age: ${age} years old`;
  el.classList.add('highlight');
  data.ageNum = age;
}

// ─── RADIO ───
function selectRadio(key, val, el) {
  data[key] = val;
  el.closest('.radio-group').querySelectorAll('.radio-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  if (key === 'firstTime') {
    document.getElementById('inviterGroup').classList.toggle('hidden', val !== 'Yes');
  }
}

// ─── CAMERA (REAL DEVICE + AUTO CAPTURE) ───
let mediaStream   = null;
let facingMode    = 'user';
let cameraTimers  = [];

function clearCameraTimers() {
  cameraTimers.forEach(t => clearTimeout(t));
  cameraTimers = [];
}

function sched(fn, ms) {
  const t = setTimeout(fn, ms);
  cameraTimers.push(t);
}

async function initCamera() {
  clearCameraTimers();

  const errDiv   = document.getElementById('cameraError');
  const viewport = document.getElementById('cameraViewport');
  const controls = document.getElementById('cameraControls');
  const preview  = document.getElementById('capturedPreview');
  const video    = document.getElementById('cameraVideo');
  const msg      = document.getElementById('cameraMsg');
  const oval     = document.getElementById('faceOval');
  const scan     = document.getElementById('scanLine');
  const countdown= document.getElementById('countdownBubble');

  // Reset UI
  errDiv.style.display    = 'none';
  viewport.style.display  = 'block';
  controls.style.display  = 'flex';
  preview.classList.remove('visible');
  oval.className = 'face-oval';
  scan.classList.remove('active');
  countdown.style.display = 'none';
  msg.textContent = 'Starting camera…';

  // Stop old stream
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }

  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      throw new Error('This browser does not support direct camera capture here. Use Upload Photo instead.');
    }

    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width:{ ideal:1280 }, height:{ ideal:720 } },
      audio: false
    });
    video.srcObject = mediaStream;
    await video.play();

    // Show flip button only if multiple cameras exist
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter(d => d.kind === 'videoinput');
    document.getElementById('switchCamBtn').style.display = cams.length > 1 ? 'block' : 'none';

    // ── AUTO CAPTURE SEQUENCE ──
    msg.textContent = 'Align your face within the oval…';

    sched(() => {
      oval.classList.add('scanning');
      scan.classList.add('active');
      msg.textContent = 'Detecting face…';
    }, 1500);

    sched(() => { msg.textContent = 'Hold still…'; }, 2800);

    sched(() => {
      msg.textContent = 'Capturing in…';
      runCountdown(3, () => capturePhoto());
    }, 3800);

  } catch (err) {
    viewport.style.display = 'none';
    controls.style.display = 'none';
    errDiv.style.display   = 'flex';
    const el = document.getElementById('cameraErrorMsg');
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      el.textContent = 'Camera permission denied. Tap "Allow" when your browser asks, or enable it in your phone settings, then tap Try Again.';
    } else if (err.name === 'NotFoundError') {
      el.textContent = 'No camera found on this device.';
    } else {
      el.textContent = `Camera error: ${err.message}`;
    }
  }
}

function runCountdown(n, onDone) {
  const bubble = document.getElementById('countdownBubble');
  const msg    = document.getElementById('cameraMsg');

  function tick(num) {
    if (num === 0) {
      bubble.style.display = 'none';
      onDone();
      return;
    }
    // Re-trigger animation by cloning
    bubble.style.display = 'none';
    bubble.textContent = num;
    requestAnimationFrame(() => {
      bubble.style.display = 'flex';
      bubble.style.animation = 'none';
      requestAnimationFrame(() => {
        bubble.style.animation = 'countPop .35s ease';
      });
    });
    msg.textContent = `Capturing in ${num}…`;
    sched(() => tick(num - 1), 1000);
  }
  tick(n);
}

function capturePhoto() {
  const video      = document.getElementById('cameraVideo');
  const canvas     = document.getElementById('captureCanvas');
  const flash      = document.getElementById('cameraFlash');
  const oval       = document.getElementById('faceOval');
  const scan       = document.getElementById('scanLine');
  const msg        = document.getElementById('cameraMsg');
  const viewport   = document.getElementById('cameraViewport');
  const controls   = document.getElementById('cameraControls');
  const preview    = document.getElementById('capturedPreview');
  const previewImg = document.getElementById('previewImg');

  msg.textContent = '📸 Smile!';

  // Flash
  flash.style.transition = 'none';
  flash.style.opacity    = '1';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    flash.style.transition = 'opacity 0.55s ease';
    flash.style.opacity    = '0';
  }));

  // Draw to canvas
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  data.photoDataUrl = canvas.toDataURL('image/jpeg', 0.92);

  // Stop stream
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }

  oval.classList.remove('scanning');
  oval.classList.add('captured');
  scan.classList.remove('active');

  sched(() => {
    viewport.style.display = 'none';
    controls.style.display = 'none';
    previewImg.src = data.photoDataUrl;
    preview.classList.add('visible');
  }, 600);
}

async function switchCamera() {
  facingMode = facingMode === 'user' ? 'environment' : 'user';
  await initCamera();
}

function retakePhoto() {
  document.getElementById('capturedPreview').classList.remove('visible');
  document.getElementById('cameraViewport').style.display = 'block';
  document.getElementById('cameraControls').style.display = 'flex';
  data.photoDataUrl = null;
  initCamera();
}

function startCamera() { initCamera(); }

function goToIdCard() {
  collectData();
  populateCard();
  showScreen('screen-idcard');
}

// ─── ID CARD ───
function generateMemberId() {
  const state = (data.stateOrigin || 'LAG').slice(0,3).toUpperCase();
  const num = String(Math.floor(Math.random()*9000)+1000);
  return `GHO-${state}-2026-${num}`;
}

function populateCard() {
  data.memberId = data.memberId || generateMemberId();
  const ageStr = data.ageNum ? `${data.ageNum} yrs` : '—';

  document.getElementById('cardName').textContent = data.fullName || '—';
  document.getElementById('cardDept').textContent = (data.department || 'Member').toUpperCase();
  document.getElementById('cardAge').textContent = ageStr;
  document.getElementById('cardPhone').textContent = data.phone || '—';
  document.getElementById('cardEmail').textContent = data.email || '—';
  document.getElementById('cardAddr').textContent = (data.address || '—').slice(0,30);
  document.getElementById('cardMemberId').textContent = data.memberId;

  // Show real photo if captured, else emoji fallback
  const photoWrap = document.getElementById('cardPhoto');
  if (data.photoDataUrl) {
    photoWrap.innerHTML = `<img src="${data.photoDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" alt="Member photo">`;
  } else {
    photoWrap.textContent = '🧑';
  }

  // Back
  document.getElementById('backNokName').textContent = data.nokName || '—';
  document.getElementById('backNokPhone').textContent = data.nokPhone || '—';
  document.getElementById('backNationality').textContent = data.nationality || 'Nigerian';
  document.getElementById('backState').textContent = data.stateOrigin || '—';

  const now = new Date();
  const issued = now.toLocaleDateString('en-NG', {day:'2-digit',month:'short',year:'numeric'});
  const expiry = new Date(now.setFullYear(now.getFullYear()+2)).toLocaleDateString('en-NG', {day:'2-digit',month:'short',year:'numeric'});
  document.getElementById('backIssued').textContent = issued;
  document.getElementById('backExpiry').textContent = expiry;
  document.getElementById('backSig').textContent = data.fullName || 'Member Signature';

  document.getElementById('successName').textContent = data.fullName ? `Welcome, ${data.fullName.split(' ')[0]}!` : 'Welcome to the family!';
  document.getElementById('successIdDisplay').textContent = data.memberId;
  document.getElementById('successMsg').textContent =
    `Your membership has been confirmed, ${data.fullName?.split(' ')[0] || 'dear friend'}. Your ID card (${data.memberId}) has been generated. You are now a valued member of Global Harvest Outer Ringroad. See you Sunday!`;
}

function flipCard() {
  isFlipped = !isFlipped;
  document.getElementById('card3DInner').classList.toggle('flipped', isFlipped);
}

function tiltCard(e) {
  const scene = document.getElementById('card3DScene');
  const inner = document.getElementById('card3DInner');
  const rect = scene.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width - 0.5;
  const y = (e.clientY - rect.top)  / rect.height - 0.5;
  const rotY = isFlipped ? 180 + x*12 : x*12;
  const rotX = -y * 8;
  inner.style.transform = `rotateY(${rotY}deg) rotateX(${rotX}deg)`;
}

function resetTilt() {
  const inner = document.getElementById('card3DInner');
  inner.style.transform = isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)';
}

function downloadCard() {
  const photo = data.photoDataUrl
    ? `<img src="${data.photoDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:6px;" alt="photo">`
    : `<span style="font-size:2.8rem">🧑</span>`;

  const now      = new Date();
  const issued   = now.toLocaleDateString('en-NG', {day:'2-digit',month:'short',year:'numeric'});
  const expiry   = new Date(new Date().setFullYear(now.getFullYear()+2))
                     .toLocaleDateString('en-NG', {day:'2-digit',month:'short',year:'numeric'});

  const cardHtml = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Member ID — ${data.fullName||'Member'}</title>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Cormorant+Garamond:ital,wght@0,300;0,600;1,300&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#07070E;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px 16px;font-family:'DM Sans',sans-serif;color:#F0EDE6}
  h1{font-family:'Cinzel',serif;font-size:.7rem;letter-spacing:.25em;color:#C9A84C;margin-bottom:28px;text-align:center;opacity:.7}

  /* CARD FRONT */
  .card{
    width:100%;max-width:380px;
    background:linear-gradient(135deg,#1A1A28 0%,#0E0E18 55%,#1A1428 100%);
    border:1px solid rgba(201,168,76,0.35);
    border-radius:18px;padding:22px 24px 20px;
    box-shadow:0 0 0 1px rgba(201,168,76,0.06),0 24px 70px rgba(0,0,0,0.7);
    position:relative;overflow:hidden;
    margin-bottom:16px;
  }
  .card::before{
    content:'';position:absolute;inset:0;
    background:radial-gradient(ellipse 80% 60% at 30% 40%,rgba(201,168,76,0.07),transparent 60%),
               radial-gradient(ellipse 60% 80% at 80% 60%,rgba(123,111,232,0.05),transparent 60%);
    pointer-events:none;
  }
  .card::after{
    content:'';position:absolute;bottom:-50px;right:-50px;
    width:200px;height:200px;border-radius:50%;
    border:1px solid rgba(201,168,76,0.07);
    box-shadow:0 0 0 35px rgba(201,168,76,0.04),0 0 0 70px rgba(201,168,76,0.02);
  }

  .church-name{
    font-family:'Cinzel',serif;font-size:.82rem;font-weight:600;
    letter-spacing:.18em;color:#E8C97A;text-align:center;
    display:flex;align-items:center;gap:10px;margin-bottom:18px;
    position:relative;z-index:2;
    text-shadow:0 0 20px rgba(201,168,76,0.4);
  }
  .church-name::before,.church-name::after{
    content:'';flex:1;height:1px;
    background:linear-gradient(90deg,transparent,rgba(201,168,76,0.5));
  }
  .church-name::after{background:linear-gradient(90deg,rgba(201,168,76,0.5),transparent)}

  .body{display:flex;gap:18px;align-items:flex-start;position:relative;z-index:2}
  .photo-wrap{
    width:80px;height:95px;border-radius:10px;
    border:2px solid rgba(201,168,76,0.5);overflow:hidden;flex-shrink:0;
    background:#16161F;display:flex;align-items:center;justify-content:center;
  }
  .photo-wrap img{width:100%;height:100%;object-fit:cover;border-radius:8px}
  .info{flex:1}
  .name{font-family:'Cormorant Garamond',serif;font-size:1.25rem;font-weight:600;line-height:1.2;margin-bottom:3px}
  .dept{font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;color:#C9A84C;margin-bottom:12px}
  .detail{font-size:.7rem;color:#9B9894;display:flex;gap:8px;margin-bottom:5px;align-items:flex-start}
  .detail-lbl{color:rgba(201,168,76,0.65);min-width:44px;flex-shrink:0;font-size:.65rem}

  .footer{
    display:flex;align-items:center;justify-content:space-between;
    margin-top:18px;padding-top:12px;
    border-top:1px solid rgba(201,168,76,0.15);
    position:relative;z-index:2;
  }
  .member-id{font-family:'Cinzel',serif;font-size:.72rem;letter-spacing:.1em;color:#E8C97A}
  .verified{font-size:.62rem;color:#4ECBA8;letter-spacing:.08em}

  /* CARD BACK */
  .card-back{
    width:100%;max-width:380px;
    background:linear-gradient(135deg,#0E0E18,#1A1A28);
    border:1px solid rgba(201,168,76,0.2);
    border-radius:18px;padding:22px 24px;
    box-shadow:0 24px 70px rgba(0,0,0,0.7);
  }
  .back-title{font-family:'Cinzel',serif;font-size:.68rem;letter-spacing:.18em;color:#C9A84C;text-transform:uppercase;border-bottom:1px solid rgba(201,168,76,0.15);padding-bottom:8px;margin-bottom:12px}
  .back-row{display:flex;justify-content:space-between;margin-bottom:8px}
  .back-lbl{font-size:.67rem;color:#9B9894}
  .back-val{font-size:.67rem;color:#F0EDE6}
  .sig-line{border-bottom:1px solid rgba(201,168,76,0.35);margin-top:16px;padding-bottom:4px;font-family:'Cormorant Garamond',serif;font-style:italic;font-size:.8rem;color:#9B9894}
  .verse{font-size:.6rem;color:#9B9894;text-align:center;font-style:italic;margin-top:10px;font-family:'Cormorant Garamond',serif}

  /* QR */
  .qr-wrap{position:absolute;bottom:18px;right:20px;width:52px;height:52px}
  @media print{body{background:#fff;padding:0} .card,.card-back{box-shadow:none;border-color:#ccc} .church-name,.member-id,.dept,.detail-lbl{color:#8B6914!important} .name,.back-val{color:#111!important} .detail,.back-lbl,.sig-line,.verse{color:#555!important} .verified{color:#2A8060!important}}
</style>
</head><body>
<h1>GLOBAL HARVEST OUTER RINGROAD — MEMBER IDENTIFICATION</h1>

<div class="card">
  <div class="church-name">Global Harvest Outer Ringroad</div>
  <div class="body">
    <div class="photo-wrap">${photo}</div>
    <div class="info">
      <div class="name">${data.fullName||'—'}</div>
      <div class="dept">${(data.department||'Member').toUpperCase()}</div>
      <div class="detail"><span class="detail-lbl">Age</span>${data.ageNum ? data.ageNum+' years' : '—'}</div>
      <div class="detail"><span class="detail-lbl">Gender</span>${data.gender||'—'}</div>
      <div class="detail"><span class="detail-lbl">Phone</span>${data.phone||'—'}</div>
      <div class="detail"><span class="detail-lbl">Email</span><span style="font-size:.62rem;word-break:break-all">${data.email||'—'}</span></div>
      <div class="detail"><span class="detail-lbl">Address</span><span style="font-size:.62rem">${data.address||'—'}</span></div>
    </div>
  </div>
  <div class="footer">
    <div class="member-id">${data.memberId||'GHO-LAG-2026-0000'}</div>
    <div class="verified">✦ VERIFIED MEMBER</div>
  </div>
  <div class="qr-wrap">
    <svg viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" fill="#0A0A0F" rx="4"/>
      <rect x="4" y="4" width="14" height="14" rx="2" fill="none" stroke="#C9A84C" stroke-width="1.5"/>
      <rect x="7" y="7" width="8" height="8" fill="#C9A84C" rx="1"/>
      <rect x="26" y="4" width="14" height="14" rx="2" fill="none" stroke="#C9A84C" stroke-width="1.5"/>
      <rect x="29" y="7" width="8" height="8" fill="#C9A84C" rx="1"/>
      <rect x="4" y="26" width="14" height="14" rx="2" fill="none" stroke="#C9A84C" stroke-width="1.5"/>
      <rect x="7" y="29" width="8" height="8" fill="#C9A84C" rx="1"/>
      <rect x="26" y="26" width="4" height="4" fill="#C9A84C" rx=".5"/>
      <rect x="32" y="26" width="4" height="4" fill="#C9A84C" rx=".5"/>
      <rect x="36" y="30" width="4" height="4" fill="#C9A84C" rx=".5"/>
      <rect x="26" y="32" width="4" height="4" fill="#C9A84C" rx=".5"/>
      <rect x="32" y="36" width="4" height="4" fill="#C9A84C" rx=".5"/>
    </svg>
  </div>
</div>

<div class="card-back" style="position:relative">
  <div class="back-title">Next of Kin &amp; Church Information</div>
  <div class="back-row"><span class="back-lbl">Next of Kin</span><span class="back-val">${data.nokName||'—'}</span></div>
  <div class="back-row"><span class="back-lbl">NOK Phone</span><span class="back-val">${data.nokPhone||'—'}</span></div>
  <div class="back-row"><span class="back-lbl">Nationality</span><span class="back-val">${data.nationality||'Nigerian'}</span></div>
  <div class="back-row"><span class="back-lbl">State of Origin</span><span class="back-val">${data.stateOrigin||'—'}</span></div>
  <div class="back-row"><span class="back-lbl">Marital Status</span><span class="back-val">${data.marital||'—'}</span></div>
  <div class="back-row" style="margin-top:10px;padding-top:8px;border-top:1px solid rgba(201,168,76,0.12)"><span class="back-lbl">Date Issued</span><span class="back-val">${issued}</span></div>
  <div class="back-row"><span class="back-lbl">Expiry Date</span><span class="back-val">${expiry}</span></div>
  <div class="back-row"><span class="back-lbl">Church Line</span><span class="back-val">+234 800 GRACE</span></div>
  <div class="sig-line">${data.fullName||'Member Signature'}</div>
  <div class="verse">"For I know the plans I have for you…" — Jeremiah 29:11</div>
</div>

</body></html>`;

  const blob = new Blob([cardHtml], {type:'text/html'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `${(data.fullName||'member').replace(/\s+/g,'-')}-GlobalHarvestOuterRingroad-ID.html`;
  a.click();
}

async function submitRegistration() {
  const statusEl = document.getElementById('emailStatus');

  if (isSubmitting) {
    return false;
  }

  collectData();
  data.memberId = data.memberId || generateMemberId();

  isSubmitting = true;
  statusEl.textContent = 'Saving your registration...';

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Unable to save registration.');
    }

    data.memberId = result.member_id || data.memberId;
    document.getElementById('successIdDisplay').textContent = data.memberId;
    statusEl.textContent = 'Registration saved to the Flask backend.';
    return true;
  } catch (err) {
    statusEl.textContent = err.message || 'Unable to save registration.';
    return false;
  } finally {
    isSubmitting = false;
  }
}

function triggerPhotoUpload() {
  document.getElementById('photoUploadInput').click();
}

function showPhotoPreview(photoDataUrl) {
  const errDiv = document.getElementById('cameraError');
  const viewport = document.getElementById('cameraViewport');
  const controls = document.getElementById('cameraControls');
  const preview = document.getElementById('capturedPreview');
  const previewImg = document.getElementById('previewImg');

  data.photoDataUrl = photoDataUrl;
  errDiv.style.display = 'none';
  viewport.style.display = 'none';
  controls.style.display = 'none';
  previewImg.src = photoDataUrl;
  preview.classList.add('visible');
}

async function handlePhotoUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const fileDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Could not read the selected file.'));
      reader.readAsDataURL(file);
    });

    const photoDataUrl = await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / image.width);
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      image.onerror = () => reject(new Error('Selected file is not a valid image.'));
      image.src = fileDataUrl;
    });

    showPhotoPreview(photoDataUrl);
  } catch (err) {
    document.getElementById('cameraError').style.display = 'flex';
    document.getElementById('cameraErrorMsg').textContent = `Image upload error: ${err.message}`;
  } finally {
    event.target.value = '';
  }
}

function goBack() {
  // Stop camera stream if active
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  showScreen('screen-form');
}

async function goToSuccess() {
  const saved = await submitRegistration();
  if (!saved) {
    window.alert('Registration could not be saved. Please try again.');
    return;
  }

  populateCard();
  showScreen('screen-success');
}

// Touch tilt for mobile
document.getElementById('card3DScene').addEventListener('touchmove', function(e) {
  const touch = e.touches[0];
  const fakeEvent = { clientX: touch.clientX, clientY: touch.clientY };
  tiltCard(fakeEvent);
}, { passive:true });
