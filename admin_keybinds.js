
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
    // We use a unique name for this app instance to avoid conflicts with the page's default app
    let app;
    try {
        app = initializeApp(firebaseConfig, "adminKeybindsApp");
    } catch (e) {
        // If already initialized with this name (shouldn't happen usually), reuse it or fall back
        // Actually, if we use the default name, we might conflict. 
        // Using a specific name is safer for an injected script.
        console.warn("Admin Keybinds: App might already be initialized", e);
        app = initializeApp(firebaseConfig); // Fallback
    }

    const auth = getAuth(app);
    const db = getFirestore(app);

    // State
    let explicitEnabled = true; // Default assumption
    let lastEnablePressTime = 0;
    let isAdmin = false;

    // Monitor Global Setting
    function subscribeToConfig() {
        onSnapshot(doc(db, 'config', 'soundboard'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.explicitEnabled !== undefined) {
                    explicitEnabled = data.explicitEnabled;
                    // console.log("Admin Keybinds: Explicit sounds are now", explicitEnabled ? "ENABLED" : "DISABLED");
                }
            } else {
                // If doc doesn't exist, assume enabled and maybe create it?
                // For now, just assume enabled locally.
                explicitEnabled = true;
            }
        });
    }

    // Keybind Listener
    function setupKeybinds() {
        document.addEventListener('keydown', async (e) => {
            // Check for Ctrl + Alt + E
            if (e.ctrlKey && e.altKey && (e.key.toLowerCase() === 'e')) {
                e.preventDefault();
                console.log("Admin Keybinds: Trigger detected.");

                if (explicitEnabled) {
                    // Currently Enabled -> Disable Instantly
                    console.log("Admin Keybinds: Disabling explicit sounds...");
                    try {
                        await setDoc(doc(db, 'config', 'soundboard'), { explicitEnabled: false }, { merge: true });
                        // Reset double press timer just in case
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
    }

    // Main logic flow
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Check if user is admin
                const adminDocRef = doc(db, 'admins', user.uid);
                const adminDoc = await getDoc(adminDocRef);

                if (adminDoc.exists()) {
                    console.log("Admin Keybinds: Admin authenticated.");
                    isAdmin = true;
                    subscribeToConfig();
                    setupKeybinds();
                }
            } catch (err) {
                console.error("Admin Keybinds: Error checking admin status", err);
            }
        }
    });

})();
