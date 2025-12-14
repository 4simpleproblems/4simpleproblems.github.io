/**
 * analytics.js
 * Tracks user sessions, page views, and duration.
 * Saves data to Firestore collection "analytics".
 */
(function() {
    console.log("Analytics: Initializing...");

    // Helper to get/create Session ID
    function getSessionId() {
        let sid = sessionStorage.getItem('analytics_session_id');
        if (!sid) {
            sid = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
            sessionStorage.setItem('analytics_session_id', sid);
        }
        return sid;
    }

    const sessionId = getSessionId();
    let db = null;
    let auth = null;
    let currentUser = 'anonymous';
    let isTracking = false;

    // Wait for Firebase to be available
    function waitForFirebase() {
        if (window.firebase && window.firebase.apps.length > 0) {
            initAnalytics();
        } else {
            setTimeout(waitForFirebase, 500);
        }
    }

    function initAnalytics() {
        if (isTracking) return;
        isTracking = true;
        console.log("Analytics: Firebase found. Starting tracking.");
        
        const app = window.firebase.app(); 
        db = app.firestore();
        auth = app.auth();

        // Track user
        auth.onAuthStateChanged(user => {
            currentUser = user ? user.uid : 'anonymous';
            updateSession();
        });

        // Initialize Start Time if new session
        if (!sessionStorage.getItem('analytics_start_time')) {
            sessionStorage.setItem('analytics_start_time', Date.now());
        }

        // Track Page View
        trackPageView();

        // Heartbeat to update duration
        setInterval(updateSession, 10000); 

        // Visibility / Unload listeners
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                updateSession();
            }
        });
        
        window.addEventListener('beforeunload', () => {
             updateSession();
        });
    }

    function trackPageView() {
        if (!db) return;
        const path = window.location.pathname;
        const pageName = document.title || path;
        
        const docRef = db.collection('analytics').doc(sessionId);
        
        // Atomically add page visit and increment counter
        docRef.set({
            sessionId: sessionId,
            userAgent: navigator.userAgent,
            lastActive: window.firebase.firestore.FieldValue.serverTimestamp(),
            visitedPages: window.firebase.firestore.FieldValue.arrayUnion({
                path: path,
                title: pageName,
                timestamp: Date.now()
            }),
            pageCount: window.firebase.firestore.FieldValue.increment(1)
        }, { merge: true }).catch(err => console.error("Analytics Error:", err));
    }

    function updateSession() {
        if (!db) return;
        
        const docRef = db.collection('analytics').doc(sessionId);
        
        let startTime = parseInt(sessionStorage.getItem('analytics_start_time') || Date.now());
        const now = Date.now();
        const duration = (now - startTime) / 1000; // seconds

        docRef.set({
            userId: currentUser,
            lastActive: window.firebase.firestore.FieldValue.serverTimestamp(),
            duration: duration,
            startTime: startTime
        }, { merge: true });
    }

    waitForFirebase();

})();
