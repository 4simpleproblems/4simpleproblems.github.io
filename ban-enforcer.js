/**
 * ban-enforcer.js (v5.0 - Maximum Enforcement)
 *
 * This script protects the website by blocking interaction ONLY 
 * when the user's ban status is verified as true.
 *
 * Key Features:
 * 1. Real-time Firestore listener (onSnapshot) for ban status.
 * 2. Instant Fullscreen Exit & Lock.
 * 3. Body Content Nuke (prevents viewing page source/content via devtools elements).
 * 4. Aggressive Interval Guard.
 */

console.log("Debug: ban-enforcer.js v5.0 loaded.");

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

    // Reload page if we nuked the body previously, otherwise just unlock
    if (document.body.getAttribute('data-banned-nuke') === 'true') {
        window.location.reload();
    }
    
    document.documentElement.style.overflow = ''; 
    document.body.style.overflow = '';
}

/**
 * Renders the ban screen.
 */
function renderBanVisuals(banData) {
    // 1. Force Exit Fullscreen IMMEDIATELY
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen().catch(() => {});
    }

    // 2. Prepare Ban UI HTML
    const reason = banData.reason ? String(banData.reason).replace(/</g, "&lt;") : 'No reason provided.';
    let banTimestamp = '';
    if (banData.bannedAt && banData.bannedAt.toDate) {
        const date = banData.bannedAt.toDate();
        banTimestamp = `on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
    }

    const banHTML = `
        <div id="ban-enforcer-shield" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background-color:#000000; z-index:2147483647; display:flex; flex-direction:column; align-items:center; justify-content:center; font-family:'Geist', sans-serif; color:white; text-align:center;">
            <div style="max-width: 600px; padding: 40px; border: 1px solid #333; border-radius: 20px; background: #0a0a0a; box-shadow: 0 0 50px rgba(220, 38, 38, 0.2);">
                <i class="fa-solid fa-ban" style="font-size: 4rem; color: #ef4444; margin-bottom: 20px;"></i>
                <h1 style="font-size: 3rem; font-weight: 800; margin: 0 0 10px 0; letter-spacing: -1px;">Access Denied</h1>
                <p style="font-size: 1.2rem; color: #ef4444; font-weight: 500; margin-bottom: 30px;">Account Suspended</p>
                
                <div style="background: #111; padding: 20px; border-radius: 10px; border: 1px solid #222; margin-bottom: 30px; text-align: left;">
                    <p style="margin: 0; color: #9ca3af; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Reason</p>
                    <p style="margin: 10px 0 0 0; color: white; font-size: 1.1rem;">${reason}</p>
                </div>

                <p style="font-size: 0.85rem; color: #555; margin-bottom: 30px;">
                    Banned by administrator ${banTimestamp}.<br>ID: ${banData.uid || 'UNKNOWN'}
                </p>

                <a href="../index.html" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600; transition: transform 0.2s;">
                    <i class="fa-solid fa-arrow-left"></i> Return Home
                </a>
            </div>
        </div>
    `;

    // 3. NUKE THE BODY CONTENT if not already done
    // This is the "Stronger" part. We replace the entire body.
    if (!document.getElementById('ban-enforcer-shield')) {
        document.body.innerHTML = banHTML;
        document.body.setAttribute('data-banned-nuke', 'true');
        // Stop any background scripts/media
        window.stop(); 
    }
    
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
            if (!shield) {
                // If shield is gone (user deleted it), Nuke again
                renderBanVisuals(currentBanData);
            }
        }
    }, 200); // Check every 200ms
}

// --- 3. Auth & Firestore Listener ---
document.addEventListener('DOMContentLoaded', () => {
    
    const waitForFirestore = (callback) => {
        const maxRetries = 50;
        let attempts = 0;
        const check = () => {
            if (typeof firebase !== 'undefined' && typeof firebase.firestore === 'function') {
                callback(firebase.firestore());
            } else {
                attempts++;
                if (attempts < maxRetries) setTimeout(check, 100);
            }
        };
        check();
    };

    const initListener = () => {
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
                        // If permission denied, they might be banned/removed from DB, 
                        // but usually bans are public read or user read. 
                        // We fail safe (open) to avoid blocking valid users on network error,
                        // unless we implement a "secure fail" mode.
                    });
                });
            } else {
                unlockPage();
            }
        });
    };

    // Initialize
    if (typeof firebase === 'undefined') {
        const checkFirebase = setInterval(() => {
            if (typeof firebase !== 'undefined') {
                clearInterval(checkFirebase);
                initListener();
            }
        }, 100);
    } else {
        initListener();
    }
});