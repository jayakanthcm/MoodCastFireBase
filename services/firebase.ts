import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCBkX8trLJ4Fd5RYm5OMRiVPsN99hcXTyk",
    authDomain: "aura-4006d.firebaseapp.com",
    projectId: "aura-4006d",
    storageBucket: "aura-4006d.firebasestorage.app",
    messagingSenderId: "1066542852216",
    appId: "1:1066542852216:web:b62bab52f4bc5af7eca58d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Set persistence to session (clears when tab/window is closed)
setPersistence(auth, browserSessionPersistence).catch((error) => {
    console.error("Error setting session persistence:", error);
});

export const googleProvider = new GoogleAuthProvider();
