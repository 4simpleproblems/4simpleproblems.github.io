(async function() {
    console.log("[Admin Keybinds] Script Loaded");

    // Firebase Config
    const firebaseConfig = {
        apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
        authDomain: "project-zirconium.firebaseapp.com",
        projectId: "project-zirconium",
        storageBucket: "project-zirconium.firebasestorage.app",
        messagingSenderId: "1096564243475",
        appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
        measurementId: "G-1D4F692C1Q"
    };

    // Dynamic Imports
    const [
        { initializeApp },
        { getAuth, onAuthStateChanged },
        { getFirestore, doc, getDoc, setDoc, onSnapshot }
    ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js")
    ]);

    // Initialize Firebase
    let app;
    try {
        app = initializeApp(firebaseConfig, "adminKeybindsApp");
    } catch (e) {
        app = initializeApp(firebaseConfig); 
    }

    const auth = getAuth(app);
    const db = getFirestore(app);

    // State
    let explicitEnabled = true;
    let lastEnablePressTime = 0;
    let isAdmin = false;
    let adminUnsubscribe = null;
    let configUnsubscribe = null;
    
    const OWNER_EMAIL = "4simpleproblems@gmail.com";

    // Visual Feedback Helper
    function showAdminToast(message, color = "blue") {
        const existing = document.getElementById("admin-keybind-toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.id = "admin-keybind-toast";
        toast.style.position = "fixed";
        toast.style.bottom = "20px";
        toast.style.right = "20px";
        toast.style.backgroundColor = color === "red" ? "rgba(220, 38, 38, 0.9)" : (color === "green" ? "rgba(22, 163, 74, 0.9)" : "rgba(30, 30, 30, 0.9)");
        toast.style.color = "white";
        toast.style.padding = "12px 24px";
        toast.style.borderRadius = "8px";
        toast.style.zIndex = "999999";
        toast.style.fontFamily = "sans-serif";
        toast.style.fontWeight = "bold";
        toast.style.boxShadow = "0 4px 6px rgba(0,0,0,0.3)";
        toast.style.transition = "opacity 0.3s ease";
        toast.innerText = message;
        
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = "0";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function cleanupListeners() {
        // Only call this on logout or fatal error
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

    function subscribeToConfig() {
        if (configUnsubscribe) return;
        console.log("[Admin Keybinds] Subscribing to config...");
        configUnsubscribe = onSnapshot(doc(db, 'config', 'soundboard'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.explicitEnabled !== undefined) {
                    explicitEnabled = data.explicitEnabled;
                    console.log(`[Admin Keybinds] Explicit Enabled: ${explicitEnabled}`);
                }
            } else {
                explicitEnabled = true;
            }
        }, (error) => console.error("Config Listen Error:", error));
    }

    // Keybind Listener
    document.addEventListener('keydown', async (e) => {
        if (e.ctrlKey && e.altKey && (e.key.toLowerCase() === 'e' || e.code === 'KeyE')) {
            e.preventDefault();
            
            if (!isAdmin) {
                console.warn("[Admin Keybinds] Access denied. Not an admin.");
                return;
            }

            console.log("[Admin Keybinds] Ctrl+Alt+E detected.");

            if (explicitEnabled) {
                // Currently ON -> Turn OFF immediately
                console.log("[Admin Keybinds] Disabling explicit sounds...");
                try {
                    await setDoc(doc(db, 'config', 'soundboard'), { explicitEnabled: false }, { merge: true });
                    showAdminToast("Explicit Sounds: DISABLED", "red");
                    lastEnablePressTime = 0;
                } catch (err) {
                    console.error("[Admin Keybinds] Failed to disable:", err);
                    showAdminToast("Error: Failed to disable", "red");
                }
            } else {
                // Currently OFF -> Turn ON (Double press logic)
                const now = Date.now();
                if (now - lastEnablePressTime < 1500) { 
                    // Second press
                    console.log("[Admin Keybinds] Enabling explicit sounds...");
                    try {
                        await setDoc(doc(db, 'config', 'soundboard'), { explicitEnabled: true }, { merge: true });
                        showAdminToast("Explicit Sounds: ENABLED", "green");
                        lastEnablePressTime = 0;
                    } catch (err) {
                        console.error("[Admin Keybinds] Failed to enable:", err);
                        showAdminToast("Error: Failed to enable", "red");
                    }
                } else {
                    // First press
                    console.log("[Admin Keybinds] Waiting for confirm...");
                    showAdminToast("Press Ctrl+Alt+E again to ENABLE", "blue");
                    lastEnablePressTime = now;
                }
            }
        }
    });

    // Auth & Role Check
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // 1. Hardcoded Owner Check
            if (user.email === OWNER_EMAIL) {
                console.log(`[Admin Keybinds] Owner recognized: ${OWNER_EMAIL}`);
                isAdmin = true;
                subscribeToConfig();
                return; // Skip DB check for owner
            }

            // 2. DB Admin Check (for others)
            // Clean up old listener if it exists (e.g. fast user switch)
            if (adminUnsubscribe) adminUnsubscribe();

            adminUnsubscribe = onSnapshot(doc(db, 'admins', user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const role = (data.role || '').toLowerCase();
                    
                    console.log(`[Admin Keybinds] Role update for ${user.uid}: ${role}`);

                    if (role === 'admin' || role === 'superadmin') {
                        if (!isAdmin) {
                            console.log("[Admin Keybinds] Admin privileges active.");
                            // Optionally show toast here to let them know they are ready
                        }
                        isAdmin = true;
                        subscribeToConfig();
                    } else {
                        console.log("[Admin Keybinds] Role is not admin/superadmin.");
                        isAdmin = false;
                        // We do NOT call cleanupListeners() here because we want to keep listening 
                        // in case they are promoted to admin later without refreshing.
                    }
                } else {
                    console.log("[Admin Keybinds] Admin doc does not exist.");
                    isAdmin = false;
                    // Do NOT call cleanupListeners() here.
                }
            }, (error) => {
                console.error("[Admin Keybinds] Admin check error:", error);
                // If we can't read the doc (permission denied), they aren't admin (or rules prevent it).
                isAdmin = false;
                // Here we might want to cleanup if it's a hard error, but keeping it safe.
            });
        } else {
            cleanupListeners();
        }
    });

})();