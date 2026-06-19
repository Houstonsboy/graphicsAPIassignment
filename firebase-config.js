import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDKKwJhAFpBHJBDbHPWWfKobvBwOKcVBdE',
  authDomain: 'kadmus-3579e.firebaseapp.com',
  projectId: 'kadmus-3579e',
  storageBucket: 'kadmus-3579e.firebasestorage.app',
  messagingSenderId: '141359446177',
  appId: '1:141359446177:web:1fc4e387e46ab5da8998e0',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
