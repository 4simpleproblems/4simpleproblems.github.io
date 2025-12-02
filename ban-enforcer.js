/**
 * ban-enforcer.js (v4.1 - Real-Time Enforcement)
 *
 * This script protects the website by blocking interaction ONLY 
 * when the user's ban status is verified as true.
 *
 * Key Features:
 * 1. Real-time Firestore listener (onSnapshot) for ban status.
 * 2. Automatic visual updates if ban details change.
 * 3. Anti-tamper guard to prevent removing the ban screen.
 * 4. Geist Font & Modern UI (Bottom-Left Text, Bottom-Right Home Button).
 */

console.log("Debug: ban-enforcer.js v4.1 loaded.");

// --- Global State ---
let banGuardInterval = null;
let currentBanData = null; // Store current ban data for the guard to use

// --- 1. Font Injection (Geist) ---
(function() {
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
})();

/**
 * Removes the barrier and unlocks the page.
 * Called when user is confirmed NOT banned (or logged out).
 */
function unlockPage() {
    if (banGuardInterval) {
        clearInterval(banGuardInterval);
        banGuardInterval = null;
    }
    currentBanData = null;

    const elements = [
        'ban-enforcer-shield',
        'ban-enforcer-message',
        'ban-enforcer-home-button',
        'ban-enforcer-spinner'
    ];

    elements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });

    document.documentElement.style.overflow = ''; // Restore scrolling
    document.body.style.overflow = '';
    console.log("Debug: Page unlocked.");
}

/**
 * Renders the ban screen visuals and updates content.
 */
function renderBanVisuals(banData) {
    const shieldId = 'ban-enforcer-shield';
    const messageId = 'ban-enforcer-message';
    const homeButtonId = 'ban-enforcer-home-button';

    // 1. Shield (Barrier) - Ensure it exists and is visible
    let shield = document.getElementById(shieldId);
    if (!shield) {
        shield = document.createElement('div');
        shield.id = shieldId;
        shield.style.position = 'fixed';
        shield.style.top = '0';
        shield.style.left = '0';
        shield.style.width = '100vw';
        shield.style.height = '100vh';
        shield.style.zIndex = '2147483646';
        document.documentElement.appendChild(shield);
    }
    // Make it visible and styled
    shield.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
    shield.style.backdropFilter = 'blur(10px)';
    shield.style.webkitBackdropFilter = 'blur(10px)';
    shield.style.cursor = 'default';

    // 2. Force Fullscreen Exit
    if (document.fullscreenElement) {
        document.exitFullscreen().catch(e => console.error("Fullscreen exit error:", e));
    }

    // 3. Message Box
    let messageBox = document.getElementById(messageId);
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = messageId;
        // Styles
        messageBox.style.position = 'fixed';
        messageBox.style.bottom = '60px';
        messageBox.style.left = '60px';
        messageBox.style.color = '#ffffff';
        messageBox.style.fontFamily = "'Geist', sans-serif";
        messageBox.style.zIndex = '2147483647';
        messageBox.style.textAlign = 'left';
        messageBox.style.textShadow = '0 4px 12px rgba(0,0,0,0.5)';
        document.body.appendChild(messageBox);
    }

    // Prepare Content
    const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;") : 'No reason provided.';
    let banTimestamp = '';
    if (banData.bannedAt && banData.bannedAt.toDate) {
        const date = banData.bannedAt.toDate();
        banTimestamp = `on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
    }

    // Update Content (One line title)
    messageBox.innerHTML = `
        <h1 style="font-size: 4rem; color: #ffffff; margin: 0 0 20px 0; font-weight: 800; line-height: 1; white-space: nowrap;">Access Denied</h1>
        <p style="font-size: 1.25rem; margin: 0 0 10px 0; color: #ef4444; font-weight: 500;">Account Suspended</p>
        <div style="width: 50px; height: 4px; background-color: #ef4444; margin-bottom: 20px;"></div>
        <p style="font-size: 1rem; margin: 0 0 10px 0; color: #d1d5db; max-width: 500px; line-height: 1.6;">
            <strong>Reason:</strong> ${reason}
        </p>
        <p style="font-size: 0.85rem; color: #6b7280; margin-top: 20px;">
            Banned by administrator ${banTimestamp}.<br>
            ID: ${banData.uid || 'UNKNOWN'}
        </p>
    `;

    // 4. Home Button
    let homeButton = document.getElementById(homeButtonId);
    if (!homeButton) {
        homeButton = document.createElement('a');
        homeButton.id = homeButtonId;
        homeButton.href = '../index.html';
        homeButton.innerHTML = `<i class="fa-solid fa-house"></i>`;
        
        // Styles - Matching "btn-toolbar-style" from notes.html
        homeButton.style.position = 'fixed';
        homeButton.style.bottom = '60px';
        homeButton.style.right = '60px';
        homeButton.style.zIndex = '2147483647';
        
        // btn-toolbar-style replication
        homeButton.style.display = 'inline-flex';
        homeButton.style.alignItems = 'center';
        homeButton.style.justifyContent = 'center';
        homeButton.style.padding = '0.5rem 1rem';
        homeButton.style.backgroundColor = 'transparent'; // var(--menu-bg, #0000000)
        homeButton.style.border = '1px solid #333'; // var(--menu-border, #333)
        homeButton.style.borderRadius = '0.75rem';
        homeButton.style.color = '#d1d5db'; // var(--menu-text, #d1d5db)
        homeButton.style.fontSize = '20px'; // Adjusted size for icon
        homeButton.style.textDecoration = 'none';
        homeButton.style.cursor = 'pointer';
        homeButton.style.transition = 'all 0.2s';
        
        // Size adjustments
        homeButton.style.width = '50px';
        homeButton.style.height = '50px';

        homeButton.onmouseover = () => { 
            homeButton.style.backgroundColor = '#000000'; // var(--menu-bg)
            homeButton.style.borderColor = '#fff'; 
            homeButton.style.color = '#ffffff'; 
        };
        homeButton.onmouseout = () => { 
            homeButton.style.backgroundColor = 'transparent'; 
            homeButton.style.borderColor = '#333';
            homeButton.style.color = '#d1d5db'; 
        };

        document.body.appendChild(homeButton);
    }

    // 5. Lock Scrolling
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
}

/**
 * Entry point: Shows the ban screen and starts the anti-tamper guard.
 */
function lockPageAsBanned(banData) {
    currentBanData = banData; // Store for the guard
    
    // Render immediately
    renderBanVisuals(banData);

    // Start Guard Interval (re-renders if elements are deleted)
    if (banGuardInterval) clearInterval(banGuardInterval);
    banGuardInterval = setInterval(() => {
        if (currentBanData) {
            // Only re-render if elements are missing (light check)
            const shield = document.getElementById('ban-enforcer-shield');
            const msg = document.getElementById('ban-enforcer-message');
            if (!shield || !msg) {
                console.warn("Debug [Guard]: Ban elements missing. Restoring...");
                renderBanVisuals(currentBanData);
            }
            // Ensure scrolling is still locked
            if (document.documentElement.style.overflow !== 'hidden') {
                document.documentElement.style.overflow = 'hidden';
            }
        }
    }, 500);
}

// --- 3. Auth & Firestore Listener ---
document.addEventListener('DOMContentLoaded', () => {
    
    // Helper to safely get Firestore or wait for it
    const waitForFirestore = (callback) => {
        const maxRetries = 20;
        let attempts = 0;

        const check = () => {
            if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
                callback(firebase.firestore());
            } else {
                attempts++;
                if (attempts < maxRetries) {
                    setTimeout(check, 200); // Wait 200ms and try again
                } else {
                    console.error("Ban Enforcer: Firestore failed to load.");
                    // Do NOT lock page on failure, just fail silently or log error
                    // unlockPage() is not needed because we never locked it.
                }
            }
        };
        check();
    };

    if (typeof firebase === 'undefined') {
        // If Firebase object itself is missing, we might be loading completely async.
        // We'll try waiting a bit.
        const checkFirebase = () => {
            if (typeof firebase !== 'undefined') {
                initListener();
            } else {
                setTimeout(() => {
                    if (typeof firebase !== 'undefined') initListener();
                    else { 
                        console.error("Ban Enforcer: Firebase not found after wait.");
                    }
                }, 1000);
            }
        };
        checkFirebase();
    } else {
        initListener();
    }

    function initListener() {
        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                console.log("Debug: User logged in. Checking ban status...");
                
                waitForFirestore((dbInstance) => {
                    dbInstance.collection('bans').doc(user.uid).onSnapshot(doc => {
                        if (doc.exists) {
                            console.warn("Debug: User is BANNED.");
                            lockPageAsBanned(doc.data());
                        } else {
                            console.log("Debug: User is NOT banned.");
                            unlockPage(); // Ensure any existing ban screen is removed if status changes
                        }
                    }, error => {
                        console.error("Debug: Ban listener error.", error);
                        unlockPage();
                    });
                });

            } else {
                // User logged out
                unlockPage();
            }
        });
    }
});
