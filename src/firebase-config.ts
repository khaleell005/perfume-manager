const env = import.meta.env;
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || 'AIzaSyBwRWqEEPy4eLkCxirXNCD84iVUyB82_Kg',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || 'perfume-manager-2a6a4.firebaseapp.com',
  projectId: env.VITE_FIREBASE_PROJECT_ID || 'perfume-manager-2a6a4',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || 'perfume-manager-2a6a4.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '53195044839',
  appId: env.VITE_FIREBASE_APP_ID || '1:53195044839:web:2814ac0613863108022f42',
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || 'G-DFCHLNV0VH',
};
