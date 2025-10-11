// --- Firebase Leaderboard Service ---
import { getFirebaseConfig } from './firebase-init.js';

let db = null;
let auth = null;

export async function initLeaderboard() {
  try {
    // It is strongly recommended to revoke the old API key and generate a new one.
    // Your previous key was exposed.
    const firebaseConfig = getFirebaseConfig();

    // Initialize Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    auth = firebase.auth();

    // Sign in anonymously
    if (!auth.currentUser) {
      await auth.signInAnonymously();
    }
    console.log("Firebase Leaderboard initialized. User ID:", auth.currentUser.uid);
    return auth.currentUser.uid;
  } catch (e) {
    console.error("Firebase initialization failed. Leaderboards will be disabled.", e);
    // If firebase fails, db will be null and functions will gracefully fail.
    return null;
  }
}

function isLeaderboardReady() {
  if (db && auth && auth.currentUser) return true;
  console.warn("Leaderboard not ready. Firebase might have failed to initialize.");
  return false;
}

export function getCurrentUserId() {
  return auth?.currentUser?.uid || null;
}

export const LEADERBOARD_CATEGORIES = [
  { key: 'netWorth', label: 'Net Worth', order: 'desc' },
  { key: 'level', label: 'Player Level', order: 'desc' },
  { key: 'league', label: 'League Prestige', order: 'desc' },
];

const MAX_ENTRIES = 100; // Firestore can handle more

export async function recordLeaderboardEntry({ category, alias, profileId, value, meta = {} }) {
  if (!isLeaderboardReady() || !category || !alias || !profileId || typeof value !== 'number') return;
  const catDef = LEADERBOARD_CATEGORIES.find(c => c.key === category);
  if (!catDef) return;

  try {
    const collectionRef = db.collection(category);
    const entry = {
      alias,
      alias_lower: alias.toLowerCase(),
      profileId,
      value,
      meta: meta || {},
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      schemaVersion: 2,
    };

    // Use the profileId as the document ID to easily update/overwrite scores.
    await collectionRef.doc(profileId).set(entry, { merge: true });

  } catch (error) {
    console.error(`Failed to record leaderboard entry for ${category}:`, error);
  }
}

export async function isAliasTaken(alias) {
  if (!isLeaderboardReady()) return false; // Fail open if DB not ready
  try {
    const collectionRef = db.collection('netWorth');
    // Case-insensitive check by querying a range
    const lower = alias.toLowerCase();
    const upper = lower + '\uf8ff';
    const query = collectionRef.where('alias_lower', '>=', lower).where('alias_lower', '<=', upper).limit(1);
    const snapshot = await query.get();
    return !snapshot.empty;
  } catch (error) {
    console.error("Failed to check alias:", error);
    return false; // Fail open on error
  }
}
export async function getLeaderboardSnapshot(limit = 8) {
  if (!isLeaderboardReady()) return {};

  const snapshot = {};
  for (const cat of LEADERBOARD_CATEGORIES) {
    try {
      const collectionRef = db.collection(cat.key);
      const query = collectionRef.orderBy('value', cat.order).limit(limit);
      const querySnapshot = await query.get();
      const entries = [];
      querySnapshot.forEach(doc => {
        entries.push(doc.data());
      });
      snapshot[cat.key] = entries;
    } catch (error) {
      console.error(`Failed to fetch leaderboard for ${cat.key}:`, error);
      snapshot[cat.key] = []; // Return empty on error
    }
  }
  return snapshot;
}

export function getTopEntries(category, limit = 10) {
  // This function is kept for compatibility but now returns a promise.
  // It's better to use getLeaderboardSnapshot for a full view.
  return new Promise(async (resolve) => {
    if (!isLeaderboardReady()) resolve([]);
    const snapshot = await getLeaderboardSnapshot(limit);
    resolve(snapshot[category] || []);
  });
}

export function clearLeaderboard() {
  // This is now a server-side operation. For local dev, you can clear collections in the Firebase console.
  console.warn("clearLeaderboard() is a server-side operation and is disabled on the client.");
}
