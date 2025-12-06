(async function() {
    console.log("Admin Keybinds Script Loaded");

    // Firebase Config (Duplicated to avoid path resolution issues in mixed contexts)
    const firebaseConfig = {
        apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
        authDomain: "project-zirconium.firebaseapp.com",
        projectId: "project-zirconium",
        storageBucket: "project-zirconium.firebasestorage.app",
        messagingSenderId: "1096564243475",
        appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
        measurementId: "G-1D4F692C1Q"
    };

    // Dynamic Imports for Firebase
    const [
        { initializeApp },
        { getAuth, onAuthStateChanged },
        { getFirestore, doc, getDoc, updateDoc, setDoc, onSnapshot }
    ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);

    // Initialize Firebase
    let app;
    try {
        // Use a unique name for this app instance to avoid conflicts
        app = initializeApp(firebaseConfig, "adminKeybindsApp");
    } catch (e) {
        console.warn("Admin Keybinds: App might already be initialized", e);
        app = initializeApp(firebaseConfig); // Fallback
    }

    const auth = getAuth(app);
    const db = getFirestore(app);

    // State
    let explicitEnabled = true;
    let lastEnablePressTime = 0;
    let isAdmin = false;
    let adminUnsubscribe = null;
    let configUnsubscribe = null;

    // Cleanup function
    function cleanupListeners() {
        if (adminUnsubscribe) {
            adminUnsubscribe();
            adminUnsubscribe = null;
        }
        if (configUnsubscribe) {
            configUnsubscribe();
            configUnsubscribe = null;
        }
        isAdmin = false;
    }

    // Monitor Global Setting
    function subscribeToConfig() {
        if (configUnsubscribe) return; // Already subscribed

        configUnsubscribe = onSnapshot(doc(db, 'config', 'soundboard'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.explicitEnabled !== undefined) {
                    explicitEnabled = data.explicitEnabled;
                }
            } else {
                explicitEnabled = true;
            }
        }, (error) => {
            console.error("Admin Keybinds: Config listener error", error);
        });
    }

    // Keybind Listener
    // We attach this once. The logic inside checks isAdmin.
    document.addEventListener('keydown', async (e) => {
        // Check for Ctrl + Alt + E
        if (e.ctrlKey && e.altKey && (e.key.toLowerCase() === 'e')) {
            e.preventDefault(); // Always prevent default if key matches, to avoid browser conflicts
            
            if (!isAdmin) return; // Security check at usage time

            console.log("Admin Keybinds: Trigger detected.");

            if (explicitEnabled) {
                // Currently Enabled -> Disable Instantly
                console.log("Admin Keybinds: Disabling explicit sounds...");
                try {
                    await setDoc(doc(db, 'config', 'soundboard'), { explicitEnabled: false }, { merge: true });
                    lastEnablePressTime = 0;
                } catch (err) {
                    console.error("Admin Keybinds: Failed to disable.", err);
                }
            } else {
                // Currently Disabled -> Require Double Press to Enable
                const now = Date.now();
                if (now - lastEnablePressTime < 1500) { // 1.5 second window
                    console.log("Admin Keybinds: Enabling explicit sounds...");
                    try {
                        await setDoc(doc(db, 'config', 'soundboard'), { explicitEnabled: true }, { merge: true });
                        lastEnablePressTime = 0; // Reset
                    } catch (err) {
                        console.error("Admin Keybinds: Failed to enable.", err);
                    }
                } else {
                    console.log("Admin Keybinds: Press again to enable.");
                    lastEnablePressTime = now;
                }
            }
        }
    });

    // Main logic flow
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Real-time admin check
            adminUnsubscribe = onSnapshot(doc(db, 'admins', user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const role = data.role;
                    // Robust check for specific roles
                    if (role === 'admin' || role === 'superadmin') {
                        if (!isAdmin) console.log("Admin Keybinds: Admin privileges active.");
                        isAdmin = true;
                        subscribeToConfig();
                    } else {
                        // Doc exists but role is wrong (shouldn't happen with current logic but safe to check)
                        console.log("Admin Keybinds: Insufficient role.");
                        cleanupListeners();
                    }
                } else {
                    // Not an admin
                    if (isAdmin) console.log("Admin Keybinds: Admin privileges revoked.");
                    cleanupListeners();
                }
            }, (error) => {
                console.error("Admin Keybinds: Admin check error", error);
                cleanupListeners();
            });
        } else {
            // Logged out
            cleanupListeners();
        }
    });

})();