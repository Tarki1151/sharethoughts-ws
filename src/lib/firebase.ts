import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, Firestore, initializeFirestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator, Functions, httpsCallable } from 'firebase/functions';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let storage: FirebaseStorage;
let functionsInstance: Functions;

const isClient = typeof window !== 'undefined';
const isEmulating = process.env.NEXT_PUBLIC_EMULATOR === 'true';

// Initialize Firebase app
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  
  // Initialize services
  auth = getAuth(app);
  
  // Initialize Firestore with settings
  try {
    db = initializeFirestore(app, {
      experimentalForceLongPolling: !isClient, // Only use long polling on server
    });
  } catch (e) {
    console.error('Firestore initialization error', e);
    db = getFirestore(app);
  }
  
  storage = getStorage(app);
  functionsInstance = getFunctions(app);
  
  // Configure emulators in development environment
  if (process.env.NODE_ENV === 'development' && isClient && isEmulating) {
    try {
      // Auth
      connectAuthEmulator(auth, 'http://127.0.0.1:19099', { disableWarnings: true });
      console.log('Auth Emulator connected on port 19099');
      
      // Firestore
      connectFirestoreEmulator(db, '127.0.0.1', 18080);
      console.log('Firestore Emulator connected on port 18080');
      
      // Storage
      connectStorageEmulator(storage, '127.0.0.1', 19199);
      console.log('Storage Emulator connected on port 19199');
      
      // Functions
      connectFunctionsEmulator(functionsInstance, '127.0.0.1', 15001);
      console.log('Functions Emulator connected on port 15001');
      
      // Set a flag to prevent multiple initializations
      (window as any).emulatorsInitialized = true;
    } catch (error) {
      console.error('Error connecting to emulators:', error);
    }
  }
} else {
  app = getApp();
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  functionsInstance = getFunctions(app);
}

// HTTPS Callable Functions (Cloud Functions)
// Bu isimlerin Firebase projenizdeki Cloud Function isimleriyle eşleştiğinden emin olun.
// Örneğin, `functions/src/users.ts` içinde `export const getUserByEmail = functions.https.onCall(...)` gibi.
const sendInvitationEmailFunction = httpsCallable(functionsInstance, 'sendInvitationEmail');
// Eğer başka callable function'larınız varsa, onları da buraya ekleyebilirsiniz.
// Örneğin: const anotherFunction = httpsCallable(functionsInstance, 'anotherFunctionName');

// Cloud Functions
const getUserByEmailFunction = async (email: string) => {
  try {
    if (!auth.currentUser) {
      console.error('User not authenticated');
      throw new Error('User not authenticated');
    }
    
    console.log('Getting ID token for current user');
    // Force token refresh to get a fresh token
    const token = await auth.currentUser.getIdToken(/* forceRefresh */ true);
    console.log('Got ID token, length:', token.length);
    
    const functionUrl = `https://europe-west1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/getUserByEmailHttp`;
    console.log('Calling function URL:', functionUrl);
    
    const requestBody = JSON.stringify({ email });
    console.log('Request body:', requestBody);
    
    let response;
    try {
      response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Client-Version': 'web-1.0.0' // For tracking
        },
        mode: 'cors',
        credentials: 'same-origin',
        body: requestBody
      });
    } catch (networkError) {
      console.error('Network error when calling function:', networkError);
      throw new Error('Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin.');
    }
    
    let responseText;
    try {
      responseText = await response.text();
      console.log('Raw response:', responseText);
    } catch (readError) {
      console.error('Error reading response text:', readError);
      throw new Error('Sunucudan yanıt alınamadı. Lütfen daha sonra tekrar deneyin.');
    }
    
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', responseText);
      console.error('Parse error:', parseError);
      throw new Error('Geçersiz sunucu yanıtı. Lütfen daha sonra tekrar deneyin.');
    }
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('Error response:', responseData);
      const errorMessage = responseData.message || 'Kullanıcı aranırken bir hata oluştu';
      const error = new Error(errorMessage);
      (error as any).code = responseData.code || 'unknown-error';
      throw error;
    }
    
    return responseData;
  } catch (error) {
    console.error('Error in getUserByEmailFunction:', error);
    // Re-throw with a more user-friendly message if needed
    if (error instanceof Error) {
      // If it's already a user-friendly error, just rethrow
      if (error.message.includes('Sunucu') || error.message.includes('bağlanılamadı') || error.message.includes('yanıt')) {
        throw error;
      }
      // Otherwise, wrap in a generic error
      throw new Error('Bir hata oluştu: ' + error.message);
    }
    throw new Error('Beklenmeyen bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
  }
};

const completeInvitationFunction = (data: { token: string }) => {
  if (!functionsInstance) {
    throw new Error('Firebase Functions not initialized');
  }
  const completeInvitation = httpsCallable(functionsInstance, 'completeInvitation');
  return completeInvitation(data);
};

export { 
  app, 
  auth, 
  db, 
  storage, 
  functionsInstance as functions,
  getUserByEmailFunction, 
  sendInvitationEmailFunction,
  completeInvitationFunction
};