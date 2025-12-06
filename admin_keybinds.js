
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
        { initializeApp, getApp },
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
        app = getApp(); // Try to get the default app
        console.log("[Admin Keybinds] Attached to existing default app.");
    } catch (e) {
        console.log("[Admin Keybinds] Default app not found, initializing new one.");
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

    // Visual Feedback Helper (Updated to match site style)
    function showAdminToast(message, type = "neutral") {
        const existing = document.getElementById("admin-keybind-toast");
        if (existing) existing.remove();

        const toast = document.createElement("div");
        toast.id = "admin-keybind-toast";

        // Styles resembling notes.html/settings.html elements
        Object.assign(toast.style, {
            position: "fixed",
            bottom: "24px",
            right: "24px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            backgroundColor: "rgba(13, 13, 13, 0.95)", // Dark glass effect
            backdropFilter: "blur(5px)",
            color: "#c0c0c0", // Light gray text
            padding: "14px 20px",
            borderRadius: "12px", // Rounded corners
            border: "1px solid #333", // Dark border
            fontFamily: "'Geist', 'Roboto', sans-serif",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
            zIndex: "9999999",
            opacity: "0",
            transform: "translateY(20px)",
            transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        });

        // Type-specific accents (using FontAwesome icons if available)
        let iconHtml = '';
        if (type === "success" || type === "green") {
            toast.style.borderColor = "rgba(34, 197, 94, 0.5)"; // Green hint
            iconHtml = '<i class="fa-solid fa-check-circle" style="color: #4ade80;"></i>';
        } else if (type === "error" || type === "red") {
            toast.style.borderColor = "rgba(239, 68, 68, 0.5)"; // Red hint
            iconHtml = '<i class="fa-solid fa-circle-exclamation" style="color: #f87171;"></i>';
        } else {
            toast.style.borderColor = "rgba(59, 130, 246, 0.5)"; // Blue hint
            iconHtml = '<i class="fa-solid fa-info-circle" style="color: #60a5fa;"></i>';
        }

        toast.innerHTML = `${iconHtml}<span>${message}</span>`;
        document.body.appendChild(toast);

        // Animation In
        requestAnimationFrame(() => {
            toast.style.opacity = "1";
            toast.style.transform = "translateY(0)";
        });

        // Animation Out
        setTimeout(() => {
            toast.style.opacity = "0";
            toast.style.transform = "translateY(10px)";
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

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

    function subscribeToConfig() {
        if (configUnsubscribe) return;
        console.log("[Admin Keybinds] Subscribing to config...");
        
        const configRef = doc(db, 'config', 'soundboard');
        
        configUnsubscribe = onSnapshot(configRef, async (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.explicitEnabled !== undefined) {
                    explicitEnabled = data.explicitEnabled;
                    console.log(`[Admin Keybinds] Explicit Enabled: ${explicitEnabled}`);
                }
            } else {
                console.log("[Admin Keybinds] Config doc missing. Defaulting to TRUE.");
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
                console.log("[Admin Keybinds] Disabling explicit sounds...");
                try {
                    await setDoc(doc(db, 'config', 'soundboard'), { explicitEnabled: false }, { merge: true });
                    showAdminToast("Explicit Sounds: DISABLED", "red");
                    lastEnablePressTime = 0;
                } catch (err) {
                    console.error("[Admin Keybinds] Failed to disable:", err);
                    showAdminToast("Error: Check Console", "red");
                }
            } else {
                const now = Date.now();
                if (now - lastEnablePressTime < 1500) { 
                    console.log("[Admin Keybinds] Enabling explicit sounds...");
                    try {
                        await setDoc(doc(db, 'config', 'soundboard'), { explicitEnabled: true }, { merge: true });
                        showAdminToast("Explicit Sounds: ENABLED", "green");
                        lastEnablePressTime = 0;
                    } catch (err) {
                        console.error("[Admin Keybinds] Failed to enable:", err);
                        showAdminToast("Error: Check Console", "red");
                    }
                } else {
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
            if (user.email && user.email.toLowerCase() === OWNER_EMAIL) {
                console.log(`[Admin Keybinds] Owner recognized: ${OWNER_EMAIL}`);
                isAdmin = true;
                subscribeToConfig();
                return;
            }

            if (adminUnsubscribe) adminUnsubscribe();

            adminUnsubscribe = onSnapshot(doc(db, 'admins', user.uid), (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const role = (data.role || '').toLowerCase();
                    
                    console.log(`[Admin Keybinds] Role update for ${user.uid}: ${role}`);

                    if (role === 'admin' || role === 'superadmin') {
                        if (!isAdmin) {
                            console.log("[Admin Keybinds] Admin privileges active.");
                        }
                        isAdmin = true;
                        subscribeToConfig();
                    } else {
                        console.log("[Admin Keybinds] Role is not admin/superadmin.");
                        isAdmin = false;
                    }
                } else {
                    console.log("[Admin Keybinds] Admin doc does not exist.");
                    isAdmin = false;
                }
            }, (error) => {
                console.error("[Admin Keybinds] Admin check error:", error);
                isAdmin = false;
            });
        } else {
            console.log("[Admin Keybinds] No user logged in.");
            cleanupListeners();
        }
    });

})();
