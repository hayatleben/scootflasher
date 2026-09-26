// ==========================================
// SCOOTERX FLASH PRO - APP.JS
// ==========================================

import { 
  verifyLicenseCode, 
  validateAdminKey, 
  getStoredCodes, 
  createLicenseCode, 
  toggleBlockCode 
} from './database.js';

// --- MODELL SPEZIFIKATIONEN & DATEN ---
const scooterModels = {
  // KuKirin G2 Serie
  kukirin_g2:         { name: 'KuKirin G2', voltage: '48V', motor: '800W', speed: '45 km/h' },
  kukirin_g2_pro:     { name: 'KuKirin G2 Pro', voltage: '48V', motor: '600W', speed: '45 km/h' },
  kukirin_g2_max:     { name: 'KuKirin G2 Max', voltage: '48V', motor: '1000W', speed: '55 km/h' },
  kukirin_g2_master:  { name: 'KuKirin G2 Master', voltage: '52V', motor: '2000W', speed: '60 km/h' },

  // KuKirin G3 Serie
  kukirin_g3:         { name: 'KuKirin G3', voltage: '52V', motor: '1200W', speed: '50 km/h' },
  kukirin_g3_pro:     { name: 'KuKirin G3 Pro', voltage: '52V', motor: '2400W', speed: '65 km/h' },

  // KuKirin G4 Serie
  kukirin_g4:         { name: 'KuKirin G4', voltage: '60V', motor: '2000W', speed: '70 km/h' },
  kukirin_g4_max:     { name: 'KuKirin G4 Max', voltage: '60V', motor: 'Dual Power', speed: '75+ km/h' },

  // Ninebot / Segway
  g3d:        { name: 'Ninebot MAX G3', voltage: '48V', motor: '1200W', speed: '40 km/h' },
  g2d:        { name: 'Ninebot MAX G2', voltage: '36V', motor: '1000W', speed: '35 km/h' },
  g30d:       { name: 'Ninebot G30D', voltage: '36V', motor: '700W', speed: '30 km/h' },
  zt3pro:     { name: 'Ninebot ZT3 Pro D', voltage: '48V', motor: '1600W', speed: '40 km/h' },
  p100s:      { name: 'Ninebot P100S', voltage: '48V', motor: '1300W', speed: '48 km/h' },
  gt2:        { name: 'Segway GT2', voltage: '52V', motor: '3000W', speed: '70 km/h' },
  f2pro:      { name: 'Ninebot F2 Pro', voltage: '36V', motor: '900W', speed: '32 km/h' },
  f40:        { name: 'Ninebot F40', voltage: '36V', motor: '700W', speed: '30 km/h' },

  // Xiaomi
  m365pro2:   { name: 'Xiaomi Pro 2', voltage: '36V', motor: '600W', speed: '30 km/h' },
  mi_1s:      { name: 'Xiaomi 1S', voltage: '36V', motor: '500W', speed: '25 km/h' },
  mi3:        { name: 'Xiaomi Scooter 3', voltage: '36V', motor: '600W', speed: '25 km/h' },
  mi4pro:     { name: 'Xiaomi 4 Pro', voltage: '48V', motor: '700W', speed: '35 km/h' },
  mi4ultra:   { name: 'Xiaomi 4 Ultra', voltage: '48V', motor: '940W', speed: '35 km/h' },

  // Navee
  navee_xt5:  { name: 'Navee XT5', voltage: '36V', motor: '700W', speed: '32 km/h' },
  navee_n65:  { name: 'Navee N65', voltage: '48V', motor: '500W', speed: '35 km/h' },
  navee_s65:  { name: 'Navee S65', voltage: '48V', motor: '1000W', speed: '38 km/h' }
};

// --- APP STATE ---
let selectedModelKey = 'kukirin_g2';
let currentSpeed = 35;
let currentPower = 1500;
let comboSequence = [];
let bluetoothDevice = null;
let bluetoothServer = null;

// --- DOM ELEMENTS ---
document.addEventListener('DOMContentLoaded', () => {
  initLicenseGate();
  initModelSelection();
  initSpeedControls();
  initPowerControls();
  initComboBuilder();
  initBluetooth();
  initAdminDashboard();
});

// ==========================================
// 1. LIZENZ GATE (LOGIN LOGIK)
// ==========================================
function initLicenseGate() {
  const form = document.getElementById('licenseForm');
  const input = document.getElementById('licenseInput');
  const errorMsg = document.getElementById('licenseError');
  const appShell = document.getElementById('appShell');
  const licenseGate = document.getElementById('licenseGate');
  const adminOpenBtn = document.getElementById('adminOpen');

  // Session State prüfen
  if (sessionStorage.getItem('scootflash_unlocked') === 'true') {
    licenseGate.style.display = 'none';
    appShell.classList.remove('locked');
    adminOpenBtn.style.display = 'inline-flex';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = input.value.trim();
    const result = verifyLicenseCode(code);

    if (result.success) {
      sessionStorage.setItem('scootflash_unlocked', 'true');
      licenseGate.style.opacity = '0';
      setTimeout(() => {
        licenseGate.style.display = 'none';
        appShell.classList.remove('locked');
        adminOpenBtn.style.display = 'inline-flex';
      }, 400);
    } else {
      errorMsg.textContent = result.message || 'Ungültiger oder gesperrter Lizenzschlüssel!';
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
    }
  });
}

// ==========================================
// 2. MODELL AUSWAHL & UI SYNCHRONISATION
// ==========================================
function initModelSelection() {
  const cards = document.querySelectorAll('.scooter-card');
  const voltageEl = document.getElementById('voltageValue');
  const motorEl = document.getElementById('motorValue');
  const rangeEl = document.getElementById('rangeValue');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');

      selectedModelKey = card.getAttribute('data-model');
      const modelData = scooterModels[selectedModelKey];

      if (modelData) {
        voltageEl.textContent = modelData.voltage;
        motorEl.textContent = modelData.motor;
        rangeEl.textContent = modelData.speed;
      }
    });
  });
}

// ==========================================
// 3. GESCHWINDIGKEITS-STEUERUNG
// ==========================================
function initSpeedControls() {
  const profileCards = document.querySelectorAll('.profile-card');
  const slider = document.getElementById('speedSlider');
  const display = document.getElementById('speedValue');

  profileCards.forEach(card => {
    card.addEventListener('click', () => {
      profileCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentSpeed = parseInt(card.getAttribute('data-speed'));
      slider.value = currentSpeed;
      display.innerHTML = `${currentSpeed} <small>km/h</small>`;
    });
  });

  slider.addEventListener('input', (e) => {
    currentSpeed = parseInt(e.target.value);
    display.innerHTML = `${currentSpeed} <small>km/h</small>`;
    
    // Aktive Profile abwählen, wenn manuell via Slider geregelt
    profileCards.forEach(c => c.classList.remove('active'));
  });
}

// ==========================================
// 4. POWER & DYNAMICS STEUERUNG
// ==========================================
function initPowerControls() {
  const powerCards = document.querySelectorAll('.power-card');
  const slider = document.getElementById('powerSlider');
  const display = document.getElementById('powerValue');

  powerCards.forEach(card => {
    card.addEventListener('click', () => {
      powerCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentPower = parseInt(card.getAttribute('data-power'));
      slider.value = currentPower;
      display.innerHTML = `${currentPower.toLocaleString()} <small>W</small>`;
    });
  });

  slider.addEventListener('input', (e) => {
    currentPower = parseInt(e.target.value);
    display.innerHTML = `${currentPower.toLocaleString()} <small>W</small>`;
    powerCards.forEach(c => c.classList.remove('active'));
  });
}

// ==========================================
// 5. TASTATUR / TRIGGER KOMBI (SCHRITT 4)
// ==========================================
function initComboBuilder() {
  const buttons = document.querySelectorAll('.combo-btn[data-input]');
  const display = document.getElementById('comboDisplay');
  const clearBtn = document.getElementById('clearCombo');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-input');
      if (comboSequence.length < 6) {
        comboSequence.push(action);
        updateComboDisplay();
      }
    });
  });

  clearBtn.addEventListener('click', () => {
    comboSequence = [];
    updateComboDisplay();
  });

  function updateComboDisplay() {
    if (comboSequence.length === 0) {
      display.innerHTML = `<span class="combo-placeholder">Min. 4 Tasten-Aktionen drücken...</span>`;
    } else {
      display.innerHTML = comboSequence.map(item => `<span class="combo-tag">${item}</span>`).join(' ➔ ');
    }
  }
}

// ==========================================
// 6. WEB-BLUETOOTH & FLASH LOGIK
// ==========================================
function initBluetooth() {
  const connectBtn = document.getElementById('connectDevice');
  const applyBtn = document.getElementById('applyButton');
  const statusLine = document.getElementById('statusLine');

  connectBtn.addEventListener('click', async () => {
    try {
      statusLine.textContent = 'Suche nach Bluetooth-Geräten...';
      
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['00001800-0000-1000-8000-00805f9b34fb']
      });

      bluetoothServer = await bluetoothDevice.gatt.connect();
      statusLine.textContent = `Verbunden mit: ${bluetoothDevice.name || 'E-Scooter'}`;
      connectBtn.classList.add('btn-success');
      connectBtn.textContent = 'Bluetooth Verbunden';
    } catch (error) {
      console.error(error);
      statusLine.textContent = 'Verbindung fehlgeschlagen oder abgebrochen.';
    }
  });

  applyBtn.addEventListener('click', async () => {
    if (comboSequence.length < 4) {
      alert('Bitte erstelle eine gültige SHU-Triggerkombination (mindestens 4 Aktionen in Schritt 04)!');
      return;
    }

    statusLine.textContent = `Kompiliere Firmware-Patch für ${scooterModels[selectedModelKey].name}...`;
    
    setTimeout(() => {
      statusLine.textContent = `Übertrage Profile: ${currentSpeed} km/h, ${currentPower}W Peak...`;
      setTimeout(() => {
        statusLine.textContent = '⚡ Tuning erfolgreich geflasht! Scooter neu starten.';
        applyBtn.classList.add('pulse-success');
      }, 2000);
    }, 1500);
  });
}

// ==========================================
// 7. ADMIN DASHBOARD MODAL
// ==========================================
function initAdminDashboard() {
  const adminOpen = document.getElementById('adminOpen');
  const adminDialog = document.getElementById('adminDialog');
  const adminClose = document.getElementById('adminClose');
  const unlockForm = document.getElementById('adminUnlockForm');
  const adminTools = document.getElementById('adminTools');
  const adminError = document.getElementById('adminError');
  const createForm = document.getElementById('createCodeForm');
  const codeList = document.getElementById('codeList');
  const searchInput = document.getElementById('codeSearchInput');

  adminOpen.addEventListener('click', () => adminDialog.showModal());
  adminClose.addEventListener('click', () => adminDialog.close());

  unlockForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = document.getElementById('adminCodeInput').value;
    
    if (validateAdminKey(key)) {
      unlockForm.hidden = true;
      adminTools.hidden = false;
      renderCodeTable();
    } else {
      adminError.textContent = 'Falscher Master-Schlüssel!';
    }
  });

  createForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const label = document.getElementById('codeLabel').value;
    const newCode = createLicenseCode(label);
    
    const box = document.getElementById('generatedCode');
    box.hidden = false;
    box.innerHTML = `Neuer Code erstellt: <b>${newCode}</b>`;
    document.getElementById('codeLabel').value = '';
    renderCodeTable();
  });

  searchInput.addEventListener('input', (e) => {
    renderCodeTable(e.target.value);
  });

  function renderCodeTable(filter = '') {
    const codes = getStoredCodes();
    const filtered = codes.filter(c => c.code.toLowerCase().includes(filter.toLowerCase()) || c.label.toLowerCase().includes(filter.toLowerCase()));
    
    // Statistiken aktualisieren
    document.getElementById('statTotal').textContent = codes.length;
    document.getElementById('statActive').textContent = codes.filter(c => !c.blocked).length;
    document.getElementById('statBlocked').textContent = codes.filter(c => c.blocked).length;

    if (filtered.length === 0) {
      codeList.innerHTML = `<p class="empty-text">Keine Einträge gefunden.</p>`;
      return;
    }

    codeList.innerHTML = filtered.map(item => `
      <div class="code-row">
        <div>
          <span class="code-string">${item.code}</span>
          <span class="code-label-tag">${item.label}</span>
        </div>
        <div>
          <button class="btn btn-sm ${item.blocked ? 'btn-success' : 'btn-danger'}" onclick="window.handleToggleBlock('${item.code}')">
            ${item.blocked ? 'Entsperren' : 'Sperren'}
          </button>
        </div>
      </div>
    `).join('');
  }

  // Globaler Helper für den Tabellen-Button
  window.handleToggleBlock = function(code) {
    toggleBlockCode(code);
    renderCodeTable(searchInput.value);
  };
}
