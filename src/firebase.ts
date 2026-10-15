import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'


const firebaseConfig = {
  apiKey: "AIzaSyCH9IPR4ieXxG0KAGuGTdQY79O2kGcH7iE",
  authDomain: "reformers-community-app.firebaseapp.com",
  projectId: "reformers-community-app",
  storageBucket: "reformers-community-app.firebasestorage.app",
  messagingSenderId: "690725787898",
  appId: "1:690725787898:web:7d939c6e820caf00561143"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app)
export const db = getFirestore(app)