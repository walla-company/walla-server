const firebase = require('firebase');
const admin = require('firebase-admin');

const useLocal = false;

const config = useLocal ? {
    apiKey: "AIzaSyBuYG5jxqySNrrLdJSU0hAX2S3GAs-zrUo",
    authDomain: "walla-server-test.firebaseapp.com",
    databaseURL: "https://walla-server-test.firebaseio.com",
    storageBucket: "walla-server-test.appspot.com",
    messagingSenderId: "40193027451"
} : {
        apiKey: "AIzaSyDly8Ewgiyhb14hHbHiSnLcu6zUOvEbuF0",
        authDomain: "walla-launch.firebaseapp.com",
        databaseURL: "https://walla-launch.firebaseio.com",
        storageBucket: "walla-launch.appspot.com",
        messagingSenderId: "261500518113"
    };


// var defaultApp = admin.initializeApp();
const defaultApp = admin.initializeApp(useLocal ? {
    credential: admin.credential.cert("admin/walla-server-test-key.json"),
    databaseURL: "https://walla-server-test.firebaseio.com"
} : {
        credential: admin.credential.cert("admin/serviceAccountKey.json"),
        databaseURL: "https://walla-launch.firebaseio.com"
    });

const defaultAuth = defaultApp.auth();
const database = defaultApp.database();
const databaseref = database.ref();

module.exports = databaseref;