import firebase from 'firebase/app';
import 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCXxTcZ8-UNLOHw24kZAc3NuE4L6IoW-wM",
  authDomain: "webrtc-f32a8.firebaseapp.com",
  projectId: "webrtc-f32a8",
  storageBucket: "webrtc-f32a8.appspot.com",
  messagingSenderId: "153371172293",
  appId: "1:153371172293:web:d842c71be78195663abfac"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

export default firestore;