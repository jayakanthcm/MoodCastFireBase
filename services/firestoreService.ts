import { db } from './firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    onSnapshot,
    query,
    where,
    deleteDoc,
    serverTimestamp,
    addDoc,
    orderBy,
    getDocs,
    increment,
    startAt,
    endAt,
    limit
} from 'firebase/firestore';
import { UserProfile, LiveAura, ChatMessage } from '../types';
import * as geofire from 'geofire-common';

export interface PersistentUserData {
    uid: string;
    email: string;
    nickname: string;
    icon: string;
    ageRange: string;
    gender: string;
    status: string;
    statusMessage?: string;
    createdAt: any;
}

export const USERS_COLLECTION = 'users';
export const SESSIONS_COLLECTION = 'live_auras';
export const CONVERSATIONS_COLLECTION = 'conversations';
export const MESSAGES_COLLECTION = 'messages';

const getConversationId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
};

export const FirestoreService = {
    // Check if a persistent user profile exists
    async getUserProfile(uid: string): Promise<PersistentUserData | null> {
        const docRef = doc(db, USERS_COLLECTION, uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as PersistentUserData;
        }
        return null;
    },

    // Create or Update persistent user profile
    async saveUserProfile(data: PersistentUserData): Promise<void> {
        const docRef = doc(db, USERS_COLLECTION, data.uid);
        await setDoc(docRef, {
            ...data,
            lastUpdated: serverTimestamp()
        }, { merge: true });
    },

    // --- Aura Session Methods (Live Presence) ---

    async createSession(session: LiveAura): Promise<void> {
        const hash = geofire.geohashForLocation([session.lat, session.lng]);
        await setDoc(doc(db, SESSIONS_COLLECTION, session.uid), {
            ...session,
            geohash: hash,
            lastSeen: serverTimestamp(), // Heartbeat initial start
            vibeColor: session.vibeColor || '#6366f1', // Default indigo
            pulseBPM: session.pulseBPM || 60
        });
    },

    async updateSession(uid: string, data: Partial<LiveAura>): Promise<void> {
        const updates: any = { ...data };

        // Compute new geohash if location changes
        if (data.lat && data.lng) {
            updates.geohash = geofire.geohashForLocation([data.lat, data.lng]);
        }

        // Always update heartbeat on interactions
        updates.lastSeen = serverTimestamp();

        await updateDoc(doc(db, SESSIONS_COLLECTION, uid), updates);
    },

    async updateHeartbeat(uid: string): Promise<void> {
        await updateDoc(doc(db, SESSIONS_COLLECTION, uid), {
            lastSeen: serverTimestamp()
        });
    },

    async deleteSession(uid: string): Promise<void> {
        await deleteDoc(doc(db, SESSIONS_COLLECTION, uid));
    },

    async updateInterest(targetUid: string, delta: number): Promise<void> {
        const ref = doc(db, SESSIONS_COLLECTION, targetUid);
        await updateDoc(ref, {
            'stats.interested': increment(delta)
        });
    },

    async updateInRadarCount(uid: string, count: number): Promise<void> {
        const ref = doc(db, SESSIONS_COLLECTION, uid);
        // Safe update using dot notation to avoid overwriting 'interested'
        await updateDoc(ref, {
            'stats.inRadar': count
        });
    },

    // Simplified Radar Query: Fetch all recently active auras (Limit 100)
    // We filter by distance on the client to ensure reliability for the MVP.
    subscribeToRadar(center: [number, number], radiusInMeters: number, callback: (sessions: LiveAura[]) => void): () => void {
        const q = query(
            collection(db, SESSIONS_COLLECTION),
            orderBy('lastSeen', 'desc'), // Show most recent first
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allSessions = snapshot.docs.map(doc => doc.data() as LiveAura);

            // Calculate who is actually in range
            const nearbySessions = allSessions.filter(session => {
                // Ensure session has lat/lng
                if (!session.lat || !session.lng) return false;

                const distanceInKm = geofire.distanceBetween(
                    [center[0], center[1]],
                    [session.lat, session.lng]
                );
                return distanceInKm * 1000 <= radiusInMeters;
            });

            console.log(`[Radar] Fetched ${allSessions.length}, Filtered to ${nearbySessions.length} nearby.`);
            callback(nearbySessions);
        });

        return unsubscribe;
    },

    // Subscribe to a specific session (for self-monitoring stats like "interested")
    subscribeToSession(uid: string, callback: (session: LiveAura | null) => void): () => void {
        const ref = doc(db, SESSIONS_COLLECTION, uid);
        return onSnapshot(ref, (snap) => {
            if (snap.exists()) {
                callback(snap.data() as LiveAura);
            } else {
                callback(null);
            }
        });
    },

    // --- Chat Methods ---

    async sendMessage(recipientId: string, text: string, senderId: string): Promise<void> {
        const conversationId = getConversationId(senderId, recipientId);
        const conversationRef = doc(db, CONVERSATIONS_COLLECTION, conversationId);
        const messagesRef = collection(conversationRef, MESSAGES_COLLECTION);

        const messageData = {
            senderId,
            text,
            timestamp: Date.now()
        };

        // Add message
        await addDoc(messagesRef, messageData);

        // Update conversation metadata (create if doesn't exist)
        await setDoc(conversationRef, {
            participants: [senderId, recipientId],
            lastMessage: text,
            lastUpdated: Date.now()
        }, { merge: true });
    },

    subscribeToConversations(userId: string, callback: (conversations: any[]) => void): () => void {
        const q = query(
            collection(db, CONVERSATIONS_COLLECTION),
            where('participants', 'array-contains', userId)
        );
        return onSnapshot(q, (snapshot) => {
            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            // Cast to any to access lastUpdated safely or fix via interface
            conversations.sort((a: any, b: any) => b.lastUpdated - a.lastUpdated);
            callback(conversations);
        });
    },

    subscribeToMessages(otherUserId: string, myUserId: string, callback: (messages: any[]) => void): () => void {
        const conversationId = getConversationId(myUserId, otherUserId);
        const q = query(
            collection(db, CONVERSATIONS_COLLECTION, conversationId, MESSAGES_COLLECTION),
            orderBy('timestamp', 'asc')
        );
        return onSnapshot(q, (snapshot) => {
            const messages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(messages);
        });
    },

    // --- Admin Methods ---

    subscribeToAllConversations(callback: (conversations: any[]) => void): () => void {
        const q = query(
            collection(db, CONVERSATIONS_COLLECTION),
            orderBy('lastUpdated', 'desc')
        );
        return onSnapshot(q, (snapshot) => {
            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            callback(conversations);
        });
    },

    async adminWipeAll(): Promise<void> {
        const sessionsSnap = await getDocs(collection(db, SESSIONS_COLLECTION));
        sessionsSnap.docs.forEach(d => deleteDoc(d.ref));

        const convSnap = await getDocs(collection(db, CONVERSATIONS_COLLECTION));
        convSnap.docs.forEach(d => deleteDoc(d.ref));
    }
};
