import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";

// if (!admin.apps.length) { // Bu kontrol index.ts'de yapıldığı için burada tekrar gerekmeyebilir.
//   admin.initializeApp();
// }

interface GetUserByEmailData {
    email: string;
}

interface UserRecordResult {
    uid: string | null;
    email?: string;
    displayName?: string | null;
    message?: string; // Hata veya bilgi mesajı için
}

// CORS middleware with enhanced error handling
const corsHandler = (req: any, res: any, handler: any) => {
  // Set CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Access-Control-Max-Age', '3600');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  // Add error handling wrapper
  return Promise.resolve()
    .then(() => handler(req, res))
    .catch((error) => {
      console.error('Error in CORS handler:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });
};

// New HTTP function with a different name
// Helper function to verify ID token with better error handling
const verifyToken = async (token: string) => {
  try {
    // First, check if token is a JWT
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format: Not a JWT');
    }

    // Try to verify the token
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    functions.logger.info('Token verified successfully', { uid: decodedToken.uid });
    return decodedToken;
  } catch (error) {
    const err = error as admin.FirebaseError;
    functions.logger.error('Token verification failed', { 
      error: err.message,
      code: err.code,
      tokenStart: token.substring(0, 10) + '...',
      tokenLength: token.length
    });
    throw error;
  }
};

export const getUserByEmailHttp = functions
  .region('europe-west1')
  .runWith({
    timeoutSeconds: 60,
    memory: '256MB',
    minInstances: 0
  })
  .https.onRequest(async (req, res) => {
  return corsHandler(req, res, async () => {
    // Check for POST method
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    // Get the token from the Authorization header
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split('Bearer ')[1] || '';
    
    if (!token) {
      functions.logger.error('No token provided');
      res.status(401).json({ 
        error: 'Unauthorized',
        message: 'No authentication token provided',
        code: 'missing-auth-token'
      });
      return;
    }
    
    try {
      // Verify the token
      await verifyToken(token);

      const data = req.body as GetUserByEmailData;
      const email = data?.email;
      
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ 
          error: 'Invalid email',
          message: 'Geçerli bir e-posta adresi gereklidir.'
        });
        return;
      }

      const userRecord = await admin.auth().getUserByEmail(email);
      functions.logger.info(`User found for email ${email}: ${userRecord.uid}`);
      
      // Ensure we're sending a valid response
      const responseData = {
        data: {
          uid: userRecord.uid,
          email: userRecord.email,
          displayName: userRecord.displayName || null
        }
      };
      
      functions.logger.debug('Sending response:', responseData);
      res.status(200).json(responseData);
    } catch (error) {
      const err = error as admin.FirebaseError;
      functions.logger.warn(`User not found for email:`, err.message, { errorCode: err.code });
      
      if (err.code === 'auth/user-not-found') {
        res.status(200).json({
          data: {
            uid: null,
            message: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı.'
          }
        });
        return;
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: 'Kullanıcı aranırken bir hata oluştu.'
      });
    }
  });
});

// Original callable function
export const getUserByEmailCallable = functions.region('europe-west1').https.onCall(
  async (data: GetUserByEmailData, context: functions.https.CallableContext): Promise<UserRecordResult> => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            "unauthenticated",
            "Bu işlemi yapmak için giriş yapmış olmalısınız."
          );
    }

    const email = data.email;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
        throw new functions.https.HttpsError(
            "invalid-argument",
            "Geçerli bir e-posta adresi gereklidir."
          );
    }

    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      functions.logger.info(`User found for email ${email}: ${userRecord.uid}`);
      return { 
          uid: userRecord.uid, 
          email: userRecord.email, 
          displayName: userRecord.displayName ?? null
      };
    } catch (error) {
      const err = error as admin.FirebaseError; // FirebaseError tipi daha spesifik
      functions.logger.warn(`User not found for email ${email}:`, err.message, { errorCode: err.code });
      if (err.code === 'auth/user-not-found') {
        return { uid: null, message: "Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı." };
      }
      // Diğer olası auth hataları (örn: 'auth/invalid-email') da burada ele alınabilir
      throw new functions.https.HttpsError(
        "internal", // Daha spesifik bir hata kodu olabilir: "not-found" veya "invalid-argument"
        err.message || "Kullanıcı aranırken bir hata oluştu."
      );
    }
  }
);