
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
    apiKey: "AIzaSyBPScXv7kgbLbK6vOSxcSH0KEtUAMF5LXs",
    authDomain: "revonn-system.firebaseapp.com",
    projectId: "revonn-system",
    storageBucket: "revonn-system.firebasestorage.app",
    messagingSenderId: "526786208336",
    appId: "1:526786208336:web:5840f40abcfa951c33a755",
    measurementId: "G-0QLK8CPW5N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, storage, analytics, googleProvider };
