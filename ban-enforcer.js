/**
 * ban-enforcer.js (v6.0 - Overlay + Guard)
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
 */

console.log("Debug: ban-enforcer.js v6.0 loaded.");

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

    // Optional Link Button (e.g., for TOS)
    let actionButton = '';
    if (banData.link) {
         actionButton = `
            <a href="${banData.link}" target="_blank" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600; transition: transform 0.2s; margin-right: 10px; pointer-events: auto;">
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
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background-color: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
        z-index: 2147483646; cursor: default;
    `;

    // 2. Message Box
    let messageBox = document.getElementById('ban-enforcer-message');
    if (!messageBox) {
        messageBox = document.createElement('div');
        messageBox.id = 'ban-enforcer-message';
        document.documentElement.appendChild(messageBox);
    }
    messageBox.style.cssText = `
        position: fixed; bottom: 60px; left: 60px; color: #ffffff;
        font-family: 'Geist', sans-serif; z-index: 2147483647;
        text-align: left; text-shadow: 0 4px 12px rgba(0,0,0,0.5);
    `;
    messageBox.innerHTML = `
        <h1 style="font-size: 4rem; color: #ffffff; margin: 0 0 20px 0; font-weight: 800; line-height: 1; white-space: nowrap;">Access Denied</h1>
        <p style="font-size: 1.25rem; margin: 0 0 10px 0; color: #ef4444; font-weight: 500;">Account Suspended</p>
        <div style="width: 50px; height: 4px; background-color: #ef4444; margin-bottom: 20px;"></div>
        <p style="font-size: 1rem; margin: 0 0 10px 0; color: #d1d5db; max-width: 500px; line-height: 1.6;">
            <strong>Reason:</strong> ${reason}
        </p>
        ${actionButton ? `<div style="margin-top: 20px;">${actionButton}</div>` : ''}
        <p style="font-size: 0.85rem; color: #6b7280; margin-top: 20px;">
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
        position: fixed; bottom: 60px; right: 60px; z-index: 2147483647;
        display: inline-flex; align-items: center; justify-content: center;
        padding: 0.5rem 1rem; background-color: transparent;
        border: 1px solid #333; border-radius: 0.75rem; color: #d1d5db;
        font-size: 20px; text-decoration: none; cursor: pointer;
        transition: all 0.2s; width: 50px; height: 50px; pointer-events: auto;
    `;
    homeButton.onmouseover = () => { homeButton.style.backgroundColor = '#000'; homeButton.style.borderColor = '#fff'; homeButton.style.color = '#fff'; };
    homeButton.onmouseout = () => { homeButton.style.backgroundColor = 'transparent'; homeButton.style.borderColor = '#333'; homeButton.style.color = '#d1d5db'; };

    // 4. Lock Scrolling
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
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