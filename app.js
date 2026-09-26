// ==========================================
// DATABASE.JS - Firebase Realtime Database
// ==========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase, ref, get, set, update } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNcwQ2mmOLLCK8XxyxHW60urDQhevLqL8",
  authDomain: "scootflash.firebaseapp.com",
  databaseURL: "https://scootflash-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "scootflash",
  storageBucket: "scootflash.firebasestorage.app",
  messagingSenderId: "583128528509",
  appId: "1:583128528509:web:4327588b889c3e84a9a314",
  measurementId: "G-9TSNW6N60K"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Master Key für das Admin Dashboard
const ADMIN_MASTER_KEY = "RT-SAMEDLEMANA-2026";

// 1. Lizenzcode in Realtime DB überprüfen
export async function verifyLicenseCode(code) {
  if (!code) return { success: false, message: 'Bitte Code eingeben.' };
  
  try {
    const codeRef = ref(db, `licenses/${code.trim()}`);
    const snapshot = await get(codeRef);

    if (!snapshot.exists()) {
      return { success: false, message: 'Unbekannter Lizenzschlüssel.' };
    }

    const data = snapshot.val();
    if (data.blocked) {
      return { success: false, message: 'Dieser Lizenzschlüssel wurde gesperrt.' };
    }

    return { success: true };
  } catch (error) {
    console.error("Datenbank Fehler:", error);
    return { success: false, message: 'Verbindungsfehler zur Datenbank.' };
  }
}

// 2. Admin Key validieren
export function validateAdminKey(key) {
  return key === ADMIN_MASTER_KEY;
}

// 3. Alle Codes abrufen (für Admin Dashboard)
export async function getStoredCodes() {
  try {
    const licensesRef = ref(db, 'licenses');
    const snapshot = await get(licensesRef);
    
    if (!snapshot.exists()) return [];

    const codesObj = snapshot.val();
    return Object.keys(codesObj).map(key => ({
      code: key,
      label: codesObj[key].label || 'Unbenannt',
      blocked: codesObj[key].blocked || false
    }));
  } catch (error) {
    console.error("Fehler beim Laden der Codes:", error);
    return [];
  }
}

// 4. Neuen Code in Realtime DB erstellen
export async function createLicenseCode(label) {
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const newCode = `RT-${randomPart}-2026`;
  
  const codeRef = ref(db, `licenses/${newCode}`);
  await set(codeRef, {
    label: label,
    blocked: false,
    createdAt: Date.now()
  });

  return newCode;
}

// 5. Code sperren oder entsperren
export async function toggleBlockCode(code) {
  const codeRef = ref(db, `licenses/${code}`);
  const snapshot = await get(codeRef);
  
  if (snapshot.exists()) {
    const currentStatus = snapshot.val().blocked || false;
    await update(codeRef, { blocked: !currentStatus });
  }
}
