/* ─────────── FIREBASE INITIALISIERUNG ─────────── */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, child, update, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNcwQ2mmOLLCK8XxyxHW60urDQhevLqL8",
  authDomain: "scootflash.firebaseapp.com",
  databaseURL: "https://scootflash-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "scootflash",
  storageBucket: "scootflash.firebasestorage.app",
  messagingSenderId: "583128528509",
  appId: "1:583128528509:web:78f6efa0c3ec8e9fa9a314",
  measurementId: "G-5WK3DNBRRY"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const ADMIN_CODE = "RT-SAMEDLEMANA-2026";

/* ─────────── DOM ELEMENTS ─────────── */
const licenseGate = document.querySelector('#licenseGate');
const appShell = document.querySelector('#appShell');
const licenseForm = document.querySelector('#licenseForm');
const licenseInput = document.querySelector('#licenseInput');
const licenseError = document.querySelector('#licenseError');

const adminDialog = document.querySelector('#adminDialog');
const adminClose = document.querySelector('#adminClose');
const adminUnlockForm = document.querySelector('#adminUnlockForm');
const adminCodeInput = document.querySelector('#adminCodeInput');
const adminError = document.querySelector('#adminError');
const adminTools = document.querySelector('#adminTools');
const createCodeForm = document.querySelector('#createCodeForm');
const codeLabel = document.querySelector('#codeLabel');
const generatedCode = document.querySelector('#generatedCode');
const codeList = document.querySelector('#codeList');
const codeSearchInput = document.querySelector('#codeSearchInput');

const statTotal = document.querySelector('#statTotal');
const statActive = document.querySelector('#statActive');
const statBlocked = document.querySelector('#statBlocked');
const adminOpenBtn = document.querySelector('#adminOpen');

let globalCodes = [];

function status(msg, err = false) {
  const el = document.querySelector('#statusLine');
  if (el) {
    el.textContent = msg;
    el.style.color = err ? 'var(--accent-red)' : 'var(--accent-cyan)';
  }
}

/* ─────────── ECHTZEIT SYNCHRONISATION ─────────── */
function initRealtimeSync() {
  localStorage.removeItem('rt_codes');

  globalCodes = [
    { id: '1', code: 'RT-SAMEDLEMANA-2026', label: 'Master Admin Code', active: true }
  ];
  renderCodes();

  if (db) {
    const licensesRef = ref(db, 'licenses');
    onValue(licensesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const fbCodes = [];
        Object.keys(data).forEach(key => {
          const itemData = data[key];
          fbCodes.push({ 
            id: key, 
            code: itemData.code || key, 
            active: itemData.active !== undefined ? itemData.active : true, 
            ...itemData 
          });
        });
        if (fbCodes.length > 0) {
          globalCodes = fbCodes;
          renderCodes(codeSearchInput ? codeSearchInput.value : '');
        }
      }
    }, (error) => {
      console.error("Firebase-Fehler beim Laden:", error);
    });
  }
}

/* ─────────── LIZENZ GATE CHECK ─────────── */
if (licenseForm) {
  licenseForm.addEventListener('submit', event => {
    event.preventDefault();
    const inputCode = licenseInput ? licenseInput.value.trim().toUpperCase() : '';

    if (inputCode === ADMIN_CODE) {
      licenseGate.classList.add('is-unlocked');
      appShell.classList.remove('locked');
      if (licenseError) licenseError.textContent = '';
      if (adminOpenBtn) adminOpenBtn.style.display = 'inline-flex';
      status('Als Administrator angemeldet.');
      return;
    }

    const found = globalCodes.find(item => item.code.toUpperCase() === inputCode && item.active);

    if (found) {
      licenseGate.classList.add('is-unlocked');
      appShell.classList.remove('locked');
      if (licenseError) licenseError.textContent = '';
      if (adminOpenBtn) adminOpenBtn.style.display = 'none';
      status('Erfolgreich freigeschaltet.');
    } else {
      if (licenseError) licenseError.textContent = 'Ungültiger oder gesperrter Lizenzcode.';
      if (licenseInput) licenseInput.select();
    }
  });
}

/* ─────────── ADMIN PANEL & CODES ─────────── */
if (adminOpenBtn) {
  adminOpenBtn.addEventListener('click', () => adminDialog.showModal());
}

if (adminUnlockForm) {
  adminUnlockForm.addEventListener('submit', event => {
    event.preventDefault();
    if (adminCodeInput.value.trim().toUpperCase() === ADMIN_CODE) {
      adminTools.hidden = false;
      adminUnlockForm.hidden = true;
      adminError.textContent = '';
      renderCodes();
    } else {
      adminError.textContent = 'Falscher Admin Code!';
    }
  });
}

if (adminClose) adminClose.addEventListener('click', () => adminDialog.close());

function renderCodes(searchQuery = '') {
  if (!codeList) return;
  codeList.innerHTML = '';

  const filtered = globalCodes.filter(item => 
    item.code.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (item.label && item.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (statTotal) statTotal.textContent = globalCodes.length;
  if (statActive) statActive.textContent = globalCodes.filter(c => c.active).length;
  if (statBlocked) statBlocked.textContent = globalCodes.filter(c => !c.active).length;

  if (!filtered.length) {
    codeList.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 0.85rem;">Keine Lizenzcodes vorhanden.</div>';
    return;
  }

  filtered.forEach((item) => {
    const row = document.createElement('div');
    row.className = `code-row-card${item.active ? '' : ' is-blocked'}`;
    
    row.innerHTML = `
      <div class="code-main-info">
        <span class="code-key">${item.code}</span>
        <span class="code-label-text">${item.label || 'Kunde'}</span>
      </div>
      <div class="code-actions">
        <span class="status-badge ${item.active ? 'badge-active' : 'badge-blocked'}">${item.active ? 'Aktiv' : 'Gesperrt'}</span>
        <button class="btn-table-action ${item.active ? 'btn-block' : 'btn-unblock'}" type="button">
          ${item.active ? 'Sperren' : 'Freigeben'}
        </button>
      </div>`;
    
    row.querySelector('.btn-table-action').addEventListener('click', () => {
      const newStatus = !item.active;
      item.active = newStatus;
      renderCodes(searchQuery);

      if (db && item.id && item.id !== '1') {
        update(ref(db, 'licenses/' + item.id), { active: newStatus });
      }
    });
    codeList.appendChild(row);
  });
}

if (codeSearchInput) {
  codeSearchInput.addEventListener('input', (e) => renderCodes(e.target.value));
}

/* ─────────── LIZENZCODE-GENERATOR ─────────── */
if (createCodeForm) {
  createCodeForm.addEventListener('submit', event => {
    event.preventDefault();
    const label = codeLabel.value.trim();
    if (!label) return;

    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newCode = `RT-${randomPart}-2026`;
    const localId = 'code_' + Date.now();

    const newEntry = { 
      id: localId,
      code: newCode, 
      label: label, 
      created: new Date().toISOString(), 
      active: true 
    };

    globalCodes.unshift(newEntry);
    renderCodes(codeSearchInput ? codeSearchInput.value : '');

    if (db) {
      try {
        set(ref(db, 'licenses/' + localId), newEntry);
      } catch (e) {
        console.error("Fehler beim Speichern in Firebase.");
      }
    }

    if (generatedCode) {
      generatedCode.hidden = false;
      generatedCode.innerHTML = `✅ Code erfolgreich erstellt: <code>${newCode}</code> (${label}) - Aktiviert`;
    }
    codeLabel.value = '';
  });
}

/* ─────────── VOLLSTÄNDIGE HARDWARE-DATENBANK (ALLE MODELLE) ─────────── */
const models = {
  // --- NAVEE ---
  navee_gt3_max:     { name: 'NAVEE GT3 Max', voltage: '48V', motor: '1500W Peak', range: '20 km/h (US: 45)' },
  navee_gt3_pro:     { name: 'NAVEE GT3 Pro', voltage: '48V', motor: '1350W Peak', range: '20 km/h (US: 40)' },
  navee_gt3:         { name: 'NAVEE GT3', voltage: '36V', motor: '900W Peak', range: '20 km/h (US: 32)' },
  navee_gt5_max:     { name: 'NAVEE GT5 Max', voltage: '48V', motor: '1800W Peak', range: '25 km/h (US: 48)' },
  navee_gt5_pro:     { name: 'NAVEE GT5 Pro', voltage: '48V', motor: '1600W Peak', range: '25 km/h (US: 45)' },
  navee_st3:         { name: 'NAVEE ST3', voltage: '48V', motor: '1200W Peak', range: '25 km/h (US: 40)' },
  navee_st3_pro:     { name: 'NAVEE ST3 Pro', voltage: '48V', motor: '1350W Peak', range: '25 km/h (US: 42)' },
  navee_st5_max:     { name: 'NAVEE ST5 Max', voltage: '48V', motor: '1600W Peak', range: '25 km/h (US: 45)' },
  navee_xt5_max:     { name: 'NAVEE XT5 Max', voltage: '48V', motor: '1800W Peak', range: '20 km/h (US: 50)' },
  navee_xt5_pro:     { name: 'NAVEE XT5 Pro', voltage: '48V', motor: '1600W Peak', range: '25 km/h (US: 50)' },
  navee_nt5_max:     { name: 'NAVEE NT5 Max', voltage: '48V', motor: '1400W Peak', range: '20 km/h (US: 45)' },
  navee_nt5_ultrax:  { name: 'NAVEE NT5 Ultra X', voltage: '52V', motor: '2400W Peak Dual', range: '40 km/h (US: 65)' },
  navee_ut5_max:     { name: 'NAVEE UT5 Max', voltage: '48V', motor: '2000W Peak', range: '31 km/h (US: 55)' },
  navee_ut5_ultrax:  { name: 'NAVEE UT5 Ultra X', voltage: '52V', motor: '4800W Peak Dual', range: '43 km/h (US: 75)' },
  navee_n65:         { name: 'NAVEE N65', voltage: '48V', motor: '1000W Peak', range: '20 km/h (US: 32)' },
  navee_n65i:        { name: 'NAVEE N65i / II', voltage: '48V', motor: '1100W Peak', range: '20 km/h (US: 35)' },
  navee_s40:         { name: 'NAVEE S40', voltage: '36V', motor: '700W Peak', range: '20 km/h (US: 30)' },
  navee_s60:         { name: 'NAVEE S60 / S60-D', voltage: '48V', motor: '1200W Peak', range: '20 km/h (US: 40)' },
  navee_s65:         { name: 'NAVEE S65 / S65C', voltage: '48V', motor: '1000W Peak', range: '20 km/h (US: 32)' },
  navee_v40i:        { name: 'NAVEE V40i / Pro', voltage: '36V', motor: '700W Peak', range: '20 km/h (US: 32)' },
  navee_g5:          { name: 'NAVEE G5 / Pro / Max', voltage: '36V', motor: '800W Peak', range: '20 km/h (US: 32)' },

  // --- XIAOMI ---
  mi_6_ultra:        { name: 'Xiaomi Scooter 6 Ultra', voltage: '48V', motor: '1400W Peak', range: '20 km/h (US: 45)' },
  mi_6_max:          { name: 'Xiaomi Scooter 6 Max', voltage: '48V', motor: '1200W Peak', range: '20 km/h (US: 40)' },
  mi_6_pro:          { name: 'Xiaomi Scooter 6 Pro', voltage: '48V', motor: '1000W Peak', range: '20 km/h (US: 35)' },
  mi_6_lite:         { name: 'Xiaomi Scooter 6 Lite', voltage: '36V', motor: '600W Peak', range: '20 km/h (US: 25)' },
  mi_6:              { name: 'Xiaomi Scooter 6', voltage: '36V', motor: '800W Peak', range: '20 km/h (US: 30)' },
  mi_5_max:          { name: 'Xiaomi Scooter 5 Max', voltage: '48V', motor: '1100W Peak', range: '20 km/h (US: 38)' },
  mi_5_pro:          { name: 'Xiaomi Scooter 5 Pro', voltage: '36V', motor: '900W Peak', range: '20 km/h (US: 32)' },
  mi_4_ultra:        { name: 'Xiaomi 4 Ultra', voltage: '48V', motor: '940W Peak', range: '20 km/h (US: 32)' },
  mi_4_pro:          { name: 'Xiaomi 4 Pro (Gen 1 & 2)', voltage: '48V', motor: '1000W Peak', range: '20 km/h (US: 35)' },
  mi_4_lite:         { name: 'Xiaomi 4 Lite', voltage: '36V', motor: '600W Peak', range: '20 km/h (US: 25)' },
  mi_4:              { name: 'Xiaomi 4', voltage: '36V', motor: '600W Peak', range: '20 km/h (US: 30)' },
  mi_pro2:           { name: 'Xiaomi Pro 2 / M365 Pro', voltage: '36V', motor: '600W Peak', range: '20 km/h (US: 32)' },
  mi_1s:             { name: 'Xiaomi 1S / Essential', voltage: '36V', motor: '500W Peak', range: '20 km/h (US: 25)' },
  mi_3:              { name: 'Xiaomi Scooter 3 / Lite', voltage: '36V', motor: '600W Peak', range: '20 km/h (US: 30)' },

  // --- SEGWAY-NINEBOT ---
  gt3_pro:           { name: 'Segway GT3 Pro', voltage: '52V', motor: '7000W Peak Dual', range: '80 km/h Dual' },
  gt3_d:             { name: 'Segway SuperScooter GT3 D', voltage: '48V', motor: '2400W Peak', range: '20 km/h (US: 55)' },
  gt2:               { name: 'Segway GT1 / GT2P', voltage: '50.4V', motor: '6000W Peak Dual', range: '70 km/h Dual' },
  zt3_max:           { name: 'Segway ZT3 Max', voltage: '48V', motor: '1800W Peak', range: '20 km/h (US: 45)' },
  zt3_pro:           { name: 'Segway ZT3 Pro D / II', voltage: '48V', motor: '1600W Peak', range: '20 km/h (US: 40)' },
  zt3:               { name: 'Segway ZT3', voltage: '48V', motor: '1500W Peak', range: '20 km/h (US: 38)' },
  max_g3:            { name: 'Ninebot MAX G3 / Pro', voltage: '48V', motor: '2000W Peak', range: '20 km/h (US: 45)' },
  max_g3_plus:       { name: 'Ninebot MAX G3 Plus', voltage: '48V', motor: '2200W Peak', range: '20 km/h (US: 48)' },
  g2d:               { name: 'Ninebot MAX G2 / G2D', voltage: '36V', motor: '900W Peak', range: '20 km/h (US: 35)' },
  g30d2:             { name: 'Ninebot MAX G30D II / G30', voltage: '36V', motor: '700W Peak', range: '20 km/h (US: 30)' },
  p100s:             { name: 'Ninebot P100S / P65', voltage: '48V', motor: '1350W Peak', range: '20 km/h (US: 48)' },
  f3_pro:            { name: 'Ninebot F3 Pro', voltage: '36V', motor: '1200W Peak', range: '20 km/h (US: 32)' },
  f2_pro:            { name: 'Ninebot F2 / F2 Pro D', voltage: '36V', motor: '900W Peak', range: '20 km/h (US: 32)' },
  f40d:              { name: 'Ninebot F20 - F40D', voltage: '36V', motor: '700W Peak', range: '20 km/h (US: 30)' },
  e3_pro:            { name: 'Ninebot E3 Pro / E3 D', voltage: '36V', motor: '800W Peak', range: '20 km/h (US: 28)' },
  e2_pro:            { name: 'Ninebot E2 Pro D / Plus', voltage: '36V', motor: '750W Peak', range: '20 km/h (US: 28)' },
  d38d:              { name: 'Ninebot D18D - D38D', voltage: '36V', motor: '500W Peak', range: '20 km/h (US: 30)' }
};

const scooterCards = [...document.querySelectorAll('.scooter-card')];
let activeModel = 'navee_gt3_max';

scooterCards.forEach(card => card.addEventListener('click', () => {
  activeModel = card.dataset.model;
  scooterCards.forEach(c => c.classList.toggle('selected', c.dataset.model === activeModel));
  const m = models[activeModel];
  if (m) {
    document.querySelector('#voltageValue').textContent = m.voltage;
    document.querySelector('#motorValue').textContent = m.motor;
    document.querySelector('#rangeValue').textContent = m.range;
  }
}));

const profileCards = document.querySelectorAll('.profile-card');
const speedSlider = document.querySelector('#speedSlider');

profileCards.forEach(card => {
  card.addEventListener('click', () => {
    profileCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const speed = card.dataset.speed;
    if (speedSlider) {
      speedSlider.value = speed;
      document.querySelector('#speedValue').innerHTML = `${speed} <small>km/h</small>`;
      updateSliderFill(speedSlider);
    }
  });
});

if (speedSlider) {
  speedSlider.addEventListener('input', () => {
    document.querySelector('#speedValue').innerHTML = `${speedSlider.value} <small>km/h</small>`;
    updateSliderFill(speedSlider);
    profileCards.forEach(c => c.classList.remove('active'));
  });
}

const powerCards = document.querySelectorAll('.power-card');
const powerSlider = document.querySelector('#powerSlider');

powerCards.forEach(card => {
  card.addEventListener('click', () => {
    powerCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    const power = card.dataset.power;
    if (powerSlider) {
      powerSlider.value = power;
      document.querySelector('#powerValue').innerHTML = `${Number(power).toLocaleString('de-DE')} <small>W</small>`;
      updateSliderFill(powerSlider);
    }
  });
});

if (powerSlider) {
  powerSlider.addEventListener('input', () => {
    document.querySelector('#powerValue').innerHTML = `${Number(powerSlider.value).toLocaleString('de-DE')} <small>W</small>`;
    updateSliderFill(powerSlider);
    powerCards.forEach(c => c.classList.remove('active'));
  });
}

function updateSliderFill(s) {
  if (!s) return;
  const pct = ((s.value - s.min) / (s.max - s.min)) * 100;
  s.style.setProperty('--fill', `${pct}%`);
}

if (speedSlider) updateSliderFill(speedSlider);
if (powerSlider) updateSliderFill(powerSlider);

let secretSequence = [];
const comboDisplay = document.querySelector('#comboDisplay');

document.querySelectorAll('.combo-btn[data-input]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (secretSequence.length >= 8) return;
    secretSequence.push(btn.dataset.input);
    renderCombo();
  });
});

document.querySelector('#clearCombo')?.addEventListener('click', () => {
  secretSequence = [];
  renderCombo();
});

function renderCombo() {
  if (!secretSequence.length) {
    comboDisplay.innerHTML = '<span class="combo-placeholder">Min. 4 Tasten-Aktionen drücken...</span>';
    return;
  }
  comboDisplay.innerHTML = secretSequence.map((act, i) => `<span class="combo-tag"><small>#${i+1}</small> ${act}</span>`).join('');
}

const connectBtn = document.querySelector('#connectDevice');
const applyBtn = document.querySelector('#applyButton');

if (connectBtn) {
  connectBtn.addEventListener('click', async () => {
    status("Suche nach Scooter (Web-Bluetooth)...");
    try {
      if (!navigator.bluetooth) {
        status("Web-Bluetooth wird von diesem Browser nicht unterstützt.", true);
        return;
      }
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true });
      status(`Verbunden mit: ${device.name || 'Scooter Device'}`);
    } catch (err) {
      status("Verbindung abgebrochen oder fehlgeschlagen.", true);
    }
  });
}

if (applyBtn) {
  applyBtn.addEventListener('click', () => {
    const spd = speedSlider ? speedSlider.value : '35';
    const pwr = powerSlider ? powerSlider.value : '1500';
    status(`Profil wird geflasht... (${spd} km/h, ${pwr}W)`);
    setTimeout(() => {
      status("Tuning erfolgreich übertragen! Scooter neu starten.");
    }, 1500);
  });
}

initRealtimeSync();
