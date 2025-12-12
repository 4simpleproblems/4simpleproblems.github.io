/**
 * ban-enforcer.js (v6.1 - Overlay + Guard + High Priority Styles)
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
 * 6. High-specificity CSS (!important) to prevent theme overrides.
 */

console.log("Debug: ban-enforcer.js v6.1 loaded.");

// --- Global State ---
let banGuardInterval = null;
let currentBanData = null; 

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
 */
function unlockPage() {
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

    document.documentElement.style.overflow = ''; 
    document.body.style.overflow = '';
}

/**
 * Renders the ban screen (Overlay Mode).
 */
function renderBanVisuals(banData) {
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

    // Optional Link Button (Glassy Red Style)
    let actionButton = '';
    if (banData.link) {
         actionButton = `
            <a href="${banData.link}" target="_blank" 
               onmouseover="this.style.borderColor='#ef4444'; this.style.color='#ef4444'; this.style.backgroundColor='rgba(239, 68, 68, 0.1)';" 
               onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.3)'; this.style.color='#ffffff'; this.style.backgroundColor='rgba(255, 255, 255, 0.05)';"
               style="
                display: inline-flex !important; 
                align-items: center !important; 
                gap: 10px !important; 
                padding: 12px 24px !important; 
                background-color: rgba(255, 255, 255, 0.05) !important; 
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                color: #ffffff !important; 
                text-decoration: none !important; 
                border: 1px solid rgba(255, 255, 255, 0.3) !important;
                border-radius: 0.75rem !important; 
                font-weight: 500 !important; 
                transition: all 0.2s ease !important; 
                margin-right: 10px !important; 
                pointer-events: auto !important;
               ">
                <i class="fa-solid fa-external-link"></i> Review Policy
            </a>
         `;
    }

    // --- Create Elements Individually (Overlay) ---

    // 1. Shield
    let shield = document.getElementById('ban-enforcer-shield');
    if (!shield) {
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
        messageBox = document.createElement('div');
        messageBox.id = 'ban-enforcer-message';
        document.documentElement.appendChild(messageBox);
    }
    messageBox.style.cssText = `
        position: fixed !important; bottom: 60px !important; left: 60px !important; 
        color: #ffffff !important;
        font-family: 'Geist', sans-serif !important; z-index: 2147483647 !important;
        text-align: left !important; text-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    `;
    messageBox.innerHTML = `
        <h1 style="font-size: 4rem !important; color: #ffffff !important; margin: 0 0 20px 0 !important; font-weight: 800 !important; line-height: 1 !important; white-space: nowrap !important;">Access Denied</h1>
        <p style="font-size: 1.25rem !important; margin: 0 0 10px 0 !important; color: #ef4444 !important; font-weight: 500 !important;">Account Suspended</p>
        <div style="width: 50px !important; height: 4px !important; background-color: #ef4444 !important; margin-bottom: 20px !important;"></div>
        <p style="font-size: 1rem !important; margin: 0 0 10px 0 !important; color: #d1d5db !important; max-width: 500px !important; line-height: 1.6 !important;">
            <strong style="font-weight: bold !important;">Reason:</strong> ${reason}
        </p>
        ${actionButton ? `<div style="margin-top: 20px !important;">${actionButton}</div>` : ''}
        <p style="font-size: 0.85rem !important; color: #6b7280 !important; margin-top: 20px !important;">
            Banned by administrator ${banTimestamp}.<br>
            ID: ${banData.uid || 'UNKNOWN'}
        </p>
    `;

    // 3. Home Button
    let homeButton = document.getElementById('ban-enforcer-home-button');
    if (!homeButton) {
        homeButton = document.createElement('a');
        homeButton.id = 'ban-enforcer-home-button';
        homeButton.href = '../index.html';
        homeButton.innerHTML = `<i class="fa-solid fa-house"></i>`;
        document.documentElement.appendChild(homeButton);
    }
    homeButton.style.cssText = `
        position: fixed !important; bottom: 60px !important; right: 60px !important; 
        z-index: 2147483647 !important;
        display: inline-flex !important; align-items: center !important; justify-content: center !important;
        padding: 0.5rem 1rem !important; background-color: transparent !important;
        border: 1px solid #333 !important; border-radius: 0.75rem !important; color: #d1d5db !important;
        font-size: 20px !important; text-decoration: none !important; cursor: pointer !important;
        transition: all 0.2s !important; width: 50px !important; height: 50px !important; 
        pointer-events: auto !important;
    `;
    
    // Manual Hover Logic for Home Button (using JS because of inline styles)
    homeButton.onmouseover = () => { 
        homeButton.style.setProperty('background-color', '#000', 'important'); 
        homeButton.style.setProperty('border-color', '#fff', 'important'); 
        homeButton.style.setProperty('color', '#fff', 'important'); 
    };
    homeButton.onmouseout = () => { 
        homeButton.style.setProperty('background-color', 'transparent', 'important'); 
        homeButton.style.setProperty('border-color', '#333', 'important'); 
        homeButton.style.setProperty('color', '#d1d5db', 'important'); 
    };

    // 4. Lock Scrolling
    document.documentElement.style.setProperty('overflow', 'hidden', 'important');
    document.body.style.setProperty('overflow', 'hidden', 'important');
}

/**
 * Enforces the ban state.
 */
function lockPageAsBanned(banData) {
    currentBanData = banData;
    
    renderBanVisuals(banData);

    // Aggressive Guard Loop
    if (banGuardInterval) clearInterval(banGuardInterval);
    banGuardInterval = setInterval(() => {
        if (currentBanData) {
            // 1. Fullscreen Check
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
            }

            // 2. DOM Integrity Check
            const shield = document.getElementById('ban-enforcer-shield');
            const msg = document.getElementById('ban-enforcer-message');
            if (!shield || !msg) {
                // If elements are gone, restore them
                renderBanVisuals(currentBanData);
            }
        }
    }, 200); // Check every 200ms
}

// --- 3. Auth & Firestore Listener ---
document.addEventListener('DOMContentLoaded', () => {

    // --- EXCLUSION CHECK ---
    const path = window.location.pathname;
    if (path.includes('messenger-v2.html')) {
        console.log("Ban Enforcer: Skipped on messenger-v2.html");
        return;
    }

    const waitForFirestore = (callback) => {
        const maxRetries = 100;
        let attempts = 0;
        const check = () => {
            if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
                callback(firebase.firestore());
            } else {
                attempts++;
                if (attempts < maxRetries) setTimeout(check, 50);
            }
        };
        check();
    };

    const initListener = () => {
        if (typeof firebase === 'undefined' || !firebase.auth) return;

        firebase.auth().onAuthStateChanged(user => {
            if (user) {
                waitForFirestore((dbInstance) => {
                    // Set up real-time listener
                    dbInstance.collection('bans').doc(user.uid).onSnapshot(doc => {
                        if (doc.exists) {
                            lockPageAsBanned({ uid: user.uid, ...doc.data() });
                        } else {
                            if (currentBanData) unlockPage();
                        }
                    }, error => {
                        console.error("Ban listener error:", error);
                    });
                });
            } else {
                unlockPage();
            }
        });
    };

    // Initialize
    const attemptInit = () => {
        if (typeof firebase !== 'undefined') {
            initListener();
        } else {
            const checkFirebase = setInterval(() => {
                if (typeof firebase !== 'undefined') {
                    clearInterval(checkFirebase);
                    initListener();
                }
            }, 50);
        }
    };
    attemptInit();
});
