// This file contains your Firebase configuration.
// It is kept separate to make it easier to manage and secure your API keys.

export function getFirebaseConfig() {
  // =================================================================================
  // PASTE YOUR NEW, SECURE FIREBASE CONFIG OBJECT HERE
  // You can get this from your Firebase project settings.
  // It is highly recommended to revoke the old key and generate a new one.
  // =================================================================================
  const firebaseConfig = {
    apiKey: "AIzaSyAWqmbRgK0yRSA_DKe07MIUgvr8h7yL92o",
    authDomain: "ics-leaderboard.firebaseapp.com",
    projectId: "ics-leaderboard",
    storageBucket: "ics-leaderboard.firebasestorage.app",
    messagingSenderId: "266728115879",
    appId: "1:266728115879:web:a24eecf88b6980b78bd582",
    measurementId: "G-B66QFXDF1V"
  };

  return firebaseConfig;
}

// NOTE: For production, consider using Firebase Hosting environment variables
// or another secure method to avoid exposing keys directly in client-side code.
// This setup is suitable for development and GitHub Pages deployment.