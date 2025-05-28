"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.completeInvitation = exports.verifyInvitation = exports.sendInvitationCallable = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
const crypto = __importStar(require("crypto"));
// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// Email configuration - using hardcoded values for testing
const getEmailConfig = () => {
    // For testing purposes, we'll use hardcoded values
    // In production, you should use environment variables or Firebase config
    console.log('Using hardcoded email config for testing');
    return {
        user: 'tarkan.cicek@gmail.com',
        pass: 'gqlu hehd wmps ymtn' // This is an app-specific password
    };
};
// Create a Nodemailer transporter
let transporter;
try {
    const emailConfig = getEmailConfig();
    transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: emailConfig.user,
            pass: emailConfig.pass,
        },
    });
}
catch (error) {
    console.error('Failed to initialize email transporter:', error);
    throw error;
}
// Generate a secure random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}
// Send invitation email
async function sendInvitationEmail(to, token, documentTitle, inviterEmail) {
    const appUrl = 'https://your-app-url.com'; // Replace with your app URL
    const invitationLink = `${appUrl}/accept-invitation?token=${token}`;
    const mailOptions = {
        from: `"ShareThoughts" <${getEmailConfig().user}>`,
        to,
        subject: `You've been invited to collaborate on "${documentTitle}"`,
        html: `
      <div>
        <h2>You've been invited to collaborate on "${documentTitle}"</h2>
        <p>${inviterEmail} has invited you to collaborate on a document.</p>
        <p>Click the link below to accept the invitation:</p>
        <p><a href="${invitationLink}">Accept Invitation</a></p>
        <p>Or copy and paste this link into your browser:</p>
        <p>${invitationLink}</p>
        <p>This link will expire in 7 days.</p>
      </div>
    `,
    };
    await transporter.sendMail(mailOptions);
}
// Callable function for sending invitations
exports.sendInvitationCallable = functions.https.onCall(async (data, context) => {
    try {
        // Check if user is authenticated
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to send invitations.');
        }
        const { email, role, documentId, documentTitle, inviterEmail } = data;
        // Validate input
        if (!email || !role || !documentId || !documentTitle) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }
        // Validate role
        if (role !== 'viewer' && role !== 'editor') {
            throw new functions.https.HttpsError('invalid-argument', 'Invalid role. Must be "viewer" or "editor"');
        }
        // Generate a unique token for this invitation
        const token = generateToken();
        const now = admin.firestore.Timestamp.now();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now
        // Create invitation in Firestore
        const invitation = {
            email,
            role,
            documentId,
            documentTitle,
            inviterEmail,
            inviterId: context.auth.uid,
            token,
            status: 'pending',
            createdAt: now,
            expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        };
        await db.collection('invitations').doc(token).set(invitation);
        // Send invitation email
        const emailConfig = getEmailConfig();
        await sendInvitationEmail(data.email, token, data.documentTitle, data.inviterEmail || emailConfig.user);
        return { success: true };
    }
    catch (error) {
        console.error('Error sending invitation:', error);
        throw new functions.https.HttpsError('internal', error instanceof Error ? error.message : 'An error occurred while sending the invitation');
    }
});
// HTTP handler for verifyInvitation
exports.verifyInvitation = functions.https.onRequest(async (req, res) => {
    // Set CORS headers for preflight requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }
        const { token, email } = req.body;
        if (!token || !email) {
            res.status(400).json({ valid: false, message: 'Token and email are required' });
            return;
        }
        // Get the invitation from Firestore
        const doc = await db.collection('invitations').doc(token).get();
        if (!doc.exists) {
            res.status(404).json({ valid: false, message: 'Invalid or expired invitation' });
            return;
        }
        const invitation = doc.data();
        // Validate invitation
        if (invitation.status !== 'pending') {
            res.status(400).json({ valid: false, message: 'Invalid invitation status' });
            return;
        }
        if (invitation.email !== email) {
            res.status(403).json({ valid: false, message: 'Email does not match invitation' });
            return;
        }
        // Check if invitation is expired
        if (invitation.expiresAt.toDate() < new Date()) {
            await doc.ref.update({ status: 'expired' });
            res.status(400).json({ valid: false, message: 'Invitation has expired' });
            return;
        }
        // Return the valid invitation data
        res.json({
            valid: true,
            email: invitation.email,
            role: invitation.role,
            documentId: invitation.documentId,
            documentTitle: invitation.documentTitle,
        });
    }
    catch (error) {
        console.error('Error verifying invitation:', error);
        res.status(500).json({
            valid: false,
            message: error instanceof Error ? error.message : 'An error occurred while verifying the invitation',
        });
    }
});
// HTTP handler for completeInvitation
exports.completeInvitation = functions.https.onRequest(async (req, res) => {
    // Set CORS headers for preflight requests
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    try {
        if (req.method !== 'POST') {
            res.status(405).json({ success: false, message: 'Method not allowed' });
            return;
        }
        const { token, email, userId } = req.body;
        if (!token || !email || !userId) {
            res.status(400).json({ success: false, message: 'Token, email, and userId are required' });
            return;
        }
        // Find the invitation
        const invitationRef = db.collection('invitations').doc(token);
        const doc = await invitationRef.get();
        if (!doc.exists) {
            res.status(404).json({ success: false, message: 'Invitation not found' });
            return;
        }
        const invitation = doc.data();
        // Validate invitation
        if (invitation.status !== 'pending') {
            res.status(400).json({ success: false, message: 'Invalid invitation status' });
            return;
        }
        if (invitation.email !== email) {
            res.status(403).json({ success: false, message: 'Email does not match invitation' });
            return;
        }
        // Check if invitation is expired
        if (invitation.expiresAt.toDate() < new Date()) {
            await invitationRef.update({ status: 'expired' });
            res.status(400).json({ success: false, message: 'Invitation has expired' });
            return;
        }
        // Update document access
        const documentRef = db.collection('documents').doc(invitation.documentId);
        await db.runTransaction(async (transaction) => {
            var _a;
            const doc = await transaction.get(documentRef);
            if (!doc.exists) {
                throw new functions.https.HttpsError('not-found', 'Document not found');
            }
            const access = ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.access) || {};
            access[userId] = {
                role: invitation.role,
                email: invitation.email,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            };
            transaction.update(documentRef, { access });
        });
        // Update invitation status
        await invitationRef.update({
            status: 'accepted',
            acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
            userId,
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error completing invitation:', error);
        res.status(500).json({
            success: false,
            message: error instanceof Error ? error.message : 'An error occurred while completing the invitation',
        });
    }
});
//# sourceMappingURL=invitations.js.map