/**
 * ban-enforcer.js (v6.5 - Ultimate Reliability Fix)
 *
 * This script protects the website by blocking interaction ONLY 
 * when the user's ban status is verified as true.
 *
 * Key Features:
 * 1. Real-time Firestore listener.
 * 2. Instant Fullscreen Exit.
 * 3. Overlay approach (preserves original body content behind opacity).
 * 4. Aggressive Interval Guard to prevent element deletion.
 * 5. Excludes 'messenger-v2.html' from enforcement.
 * 6. Uses !important for robust styling.
 * 7. Enforces max font-weight of 400.
 * 8. FIX: Robust initialization checks for Firebase App existence.
 */

console.log("BanEnforcer (v6.5): Script loaded. Waiting for Firebase App initialization...");

// --- Global State ---
let banGuardInterval = null;
let currentBanData = null; 

// --- 1. Font Injection (Geist) & Styling Constraints ---
(function() {
    console.log("BanEnforcer: Injecting fonts and custom styles...");
    if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Geist"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap';
        document.head.appendChild(link);
    }
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
        document.head.appendChild(link);
    }
    
    // Injecting style to limit font weight to 400 (max)
    const style = document.createElement('style');
    style.innerHTML = `
        #ban-enforcer-message *, #ban-enforcer-home-button, #ban-enforcer-policy-btn {
            font-weight: 400 !important;
        }
    `;
    document.head.appendChild(style);
})();

/**
 * Removes the barrier and unlocks the page.
 */
function unlockPage() {
    console.log("BanEnforcer: Calling unlockPage(). Removing visuals and interval guard.");
    if (banGuardInterval) {
        clearInterval(banGuardInterval);
        banGuardInterval = null;
    }
    currentBanData = null;

    const shield = document.getElementById('ban-enforcer-shield');
    if (shield) shield.remove();
    const msg = document.getElementById('ban-enforcer-message');
    if (msg) msg.remove();
    const btn = document.getElementById('ban-enforcer-home-button');
    if (btn) btn.remove();

    // Use !important on removals for maximum effect
    document.documentElement.style.cssText = document.documentElement.style.cssText.replace(/overflow:\s*hidden\s*!important;?/, '');
    document.body.style.cssText = document.body.style.cssText.replace(/overflow:\s*hidden\s*!important;?/, '');
}

/**
 * Renders the ban screen (Overlay Mode).
 */
function renderBanVisuals(banData) {
    console.log("BanEnforcer: Calling renderBanVisuals(). Attempting to draw shield and message box.");
    
    // 1. Force Exit Fullscreen IMMEDIATELY
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
    }

    const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;") : 'No reason provided.';
    let banTimestamp = '';
    if (banData.bannedAt && banData.bannedAt.toDate) {
        const date = banData.bannedAt.toDate();
        banTimestamp = `on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
    }

    // --- SPACING ADJUSTMENTS ---
    // Original Spacing: 60px. New Spacing (half): 30px.
    const spacing = '30px'; 
    // Home Button Size: Original 50x50px. New: 60x60px.
    const homeBtnSize = '60px'; 

    // Optional Link Button (e.g., for TOS)
    let actionButton = '';
    if (banData.link) {
         // IMPORTANT: The policy button link is now hardcoded to 'legal.html#terms-of-service'
         actionButton = `
            <a id="ban-enforcer-policy-btn" href="../legal.html#terms-of-service" target="_blank" style="
                display: inline-flex !important;
                align-items: center !important;
                gap: 10px !important;
                padding: 12px 24px !important;
                background-color: rgba(239, 68, 68, 0.1) !important; /* Reddish Tint */
                border: 1px solid #d1d5db !important; 
                color: #d1d5db !important; 
                text-decoration: none !important;
                border-radius: 1rem !important; 
                font-weight: 400 !important; 
                transition: all 0.2s !important;
                margin-right: 10px !important;
                pointer-events: auto !important;
                backdrop-filter: blur(5px) !important;
                -webkit-backdrop-filter: blur(5px) !important;
            ">
                <i class="fa-solid fa-file-lines"></i> Review Policy
            </a>
         `;
    }

    // --- Create Elements Individually (Overlay) ---

    // 1. Shield
    let shield = document.getElementById('ban-enforcer-shield');
    if (!shield) {
        console.log("BanEnforcer: Shield element not found, creating and appending.");
        shield = document.createElement('div');
        shield.id = 'ban-enforcer-shield';
        document.documentElement.appendChild(shield); // Append to HTML to cover everything
    }
    shield.style.cssText = `
        position: fixed !important; top: 0 !important; left: 0 !important; 
        width: 100vw !important; height: 100vh !important;
        background-color: rgba(0, 0, 0, 0.95) !important;
        backdrop-filter: blur(10px) !important; -webkit-backdrop-filter: blur(10px) !important;
        z-index: 2147483646 !important; cursor: default !important;
    `;

    // 2. Message Box
    let messageBox = document.getElementById('ban-enforcer-message');
    if (!messageBox) {
        console.log("BanEnforcer: Message Box element not found, creating and appending.");
        messageBox = document.createElement('div');
        messageBox.id = 'ban-enforcer-message';
        document.documentElement.appendChild(messageBox);
    }
    messageBox.style.cssText = `
        position: fixed !important; bottom: ${spacing} !important; left: ${spacing} !important; 
        color: #ffffff !important;
        font-family: 'Geist', sans-serif !important; z-index: 2147483647 !important;
        text-align: left !important; text-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    `;
    messageBox.innerHTML = `
        <h1 style="font-size: 4rem !important; color: #ffffff !important; margin: 0 0 20px 0 !important; font-weight: 400 !important; line-height: 1 !important; white-space: nowrap !important;">Access Denied</h1>
        <p style="font-size: 1.25rem !important; margin: 0 0 10px 0 !important; color: #ef4444 !important; font-weight: 400 !important;">Account Suspended</p>
        <div style="width: 50px !important; height: 4px !important; background-color: #ef4444 !important; margin-bottom: 20px !important;"></div>
        <p style="font-size: 1rem !important; margin: 0 0 10px 0 !important; color: #d1d5db !important; max-width: 500px !important; line-height: 1.6 !important; font-weight: 400 !important;">
            <strong>Reason:</strong> ${reason}
        </p>
        ${actionButton ? `<div style="margin-top: 20px !important;">${actionButton}</div>` : ''}
        <p style="font-size: 0.85rem !important; color: #6b7280 !important; margin-top: 20px !important; font-weight: 400 !important;">
            Banned by administrator ${banTimestamp}.<br>
            ID: ${banData.uid || 'UNKNOWN'}
        </p>
    `;

    // 3. Home Button
    let homeButton = document.getElementById('ban-enforcer-home-button');
    if (!homeButton) {
        console.log("BanEnforcer: Home Button element not found, creating and appending.");
        homeButton = document.createElement('a');
        homeButton.id = 'ban-enforcer-home-button';
        homeButton.href = '../index.html';
        homeButton.innerHTML = `<i class="fa-solid fa-house"></i>`;
        document.documentElement.appendChild(homeButton);
    }
    homeButton.style.cssText = `
        position: fixed !important; bottom: ${spacing} !important; right: ${spacing} !important; z-index: 2147483647 !important;
        display: inline-flex !important; align-items: center !important; justify-content: center !important;
        padding: 0.5rem 1rem !important; background-color: transparent !important;
        border: 1px solid #333 !important; border-radius: 14px !important; color: #d1d5db !important;
        font-size: 24px !important; text-decoration: none !important; cursor: pointer !important;
        transition: all 0.2s !important; width: ${homeBtnSize} !important; height: ${homeBtnSize} !important; pointer-events: auto !important;
        font-weight: 400 !important; 
    `;
    homeButton.onmouseover = () => { homeButton.style.backgroundColor = '#000 !important'; homeButton.style.borderColor = '#fff !important'; homeButton.style.color = '#fff !important'; };
    homeButton.onmouseout = () => { homeButton.style.backgroundColor = 'transparent !important'; homeButton.style.borderColor = '#333 !important'; homeButton.style.color = '#d1d5db !important'; };

    // 4. Lock Scrolling
    document.documentElement.style.overflow = 'hidden !important';
    document.body.style.overflow = 'hidden !important';
    
    // 5. Action Button Hover Listener
    if (banData.link) {
        const policyButton = document.getElementById('ban-enforcer-policy-btn');
        if (policyButton) {
            policyButton.onmouseover = () => { 
                policyButton.style.borderColor = '#ef4444 !important'; // Red Border on hover
                policyButton.style.color = '#ef4444 !important';       // Red Text on hover
            };
            policyButton.onmouseout = () => { 
                policyButton.style.borderColor = '#d1d5db !important'; // Restore Gray Border
                policyButton.style.color = '#d1d5db !important';       // Restore Gray Text
            };
        }
    }
}

/**
 * Enforces the ban state.
 */
function lockPageAsBanned(banData) {
    console.log(`BanEnforcer: lockPageAsBanned triggered for UID: ${banData.uid}. Ban Reason: ${banData.reason}.`);
    currentBanData = banData;
    
    renderBanVisuals(banData);

    // Aggressive Guard Loop
    if (banGuardInterval) clearInterval(banGuardInterval);
    banGuardInterval = setInterval(() => {
        if (currentBanData) {
            // 1. Fullscreen Check (Silence errors)
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
            }

            // 2. DOM Integrity Check
            const shield = document.getElementById('ban-enforcer-shield');
            const msg = document.getElementById('ban-enforcer-message');
            if (!shield || !msg) {
                console.warn("BanEnforcer Guard: Ban elements missing. Re-rendering visuals.");
                renderBanVisuals(currentBanData);
            }
        }
    }, 200); // Check every 200ms
}

// --- 3. Auth & Firestore Listener ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("BanEnforcer: DOMContentLoaded fired. Starting initialization...");

    // --- EXCLUSION CHECK ---
    const path = window.location.pathname;
    if (path.includes('messenger-v2.html')) {
        console.warn("BanEnforcer: Skipped enforcement on exclusion path 'messenger-v2.html'.");
        return;
    }
    console.log(`BanEnforcer: Current path (${path}) is not excluded. Proceeding.`);


    /**
     * Waits for the Firestore library to be available.
     * @param {function} callback - Function to call with the Firestore instance.
     */
    const waitForFirestore = (callback) => {
        console.log("BanEnforcer: Waiting for Firebase Firestore to be available...");
        const maxRetries = 100;
        let attempts = 0;
        const check = () => {
            if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
                console.log(`BanEnforcer: Firestore available after ${attempts} attempts. Initializing listener.`);
                callback(firebase.firestore());
            } else {
                attempts++;
                if (attempts < maxRetries) {
                    setTimeout(check, 50);
                } else {
                    console.error("BanEnforcer Error: Failed to find firebase.firestore after max retries.");
                }
            }
        };
        check();
    };

    /**
     * Initializes the Firebase Authentication and Firestore listener.
     */
    const initListener = () => {
        // At this point, firebase.apps.length > 0, and firebase.auth is available
        console.log("BanEnforcer: Initializing firebase.auth().onAuthStateChanged listener...");
        
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                console.log(`BanEnforcer Auth: User logged in. UID: ${user.uid}. Starting Firestore check.`);
                waitForFirestore((dbInstance) => {
                    // Set up real-time listener
                    dbInstance.collection('bans').doc(user.uid).onSnapshot(doc => {
                        if (doc.exists) {
                            console.log("BanEnforcer Listener: Ban document EXISTS for user. Locking page.");
                            lockPageAsBanned({ uid: user.uid, ...doc.data() });
                        } else {
                            console.log("BanEnforcer Listener: Ban document does NOT exist. Unlocking page.");
                            if (currentBanData) unlockPage();
                        }
                    }, error => {
                        console.error("BanEnforcer Listener Error: Failed to get ban status from Firestore:", error);
                    });
                });
            } else {
                console.log("BanEnforcer Auth: User logged out. Ensuring page is unlocked.");
                unlockPage();
            }
        });
    };

    /**
     * Waits specifically for firebase.auth to be defined.
     */
    const waitForAuth = (callback) => {
        console.log("BanEnforcer: Waiting for Firebase Auth library to be available...");
        const maxRetries = 100;
        let attempts = 0;
        const check = () => {
            if (typeof firebase !== 'undefined' && typeof firebase.auth === 'function') {
                 console.log(`BanEnforcer Auth: Firebase Auth library available after ${attempts} attempts. Proceeding to App check.`);
                 callback();
            } else {
                attempts++;
                if (attempts < maxRetries) {
                    setTimeout(check, 50);
                } else {
                    console.error("BanEnforcer Error: Failed to find firebase.auth after max retries. Check library loading order.");
                }
            }
        };
        check();
    };
    
    /**
     * Waits for a Firebase App to be initialized before running the listener setup.
     */
    const waitForFirebaseApp = (callback) => {
        console.log("BanEnforcer: Waiting for Firebase App (initializeApp) to be called...");
        const maxRetries = 100;
        let attempts = 0;
        const check = () => {
            // Check if firebase object exists AND if at least one app is initialized
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                 console.log(`BanEnforcer App: Firebase App initialized after ${attempts} attempts. Starting Listener setup.`);
                 callback();
            } else {
                attempts++;
                if (attempts < maxRetries) {
                    setTimeout(check, 50);
                } else {
                    console.error("BanEnforcer Error: Failed to find initialized Firebase App after max retries. Cannot run auth listener.");
                }
            }
        };
        check();
    };


    // Initialize
    const attemptInit = () => {
        // We start by ensuring the required auth library is loaded.
        // Then we ensure the app is configured.
        waitForAuth(() => {
            waitForFirebaseApp(initListener);
        });
    };
    
    attemptInit();
});
