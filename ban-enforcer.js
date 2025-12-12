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

    // Optional Link Button (e.g., for TOS)
    let actionButton = '';
    if (banData.link) {
         actionButton = `
            <a href="${banData.link}" target="_blank" style="display: inline-flex; align-items: center; gap: 10px; padding: 12px 24px; background: #fff; color: #000; text-decoration: none; border-radius: 8px; font-weight: 600; transition: transform 0.2s; margin-right: 10px;">
                <i class="fa-solid fa-external-link"></i> Review Policy
            </a>
         `;
    }

    // New Design (Reverted to v4.1 Visuals but with 'Strong' Nuke logic)
    // Using inline styles to ensure it looks correct even if CSS is missing
    const banHTML = `
        <div id="ban-enforcer-shield" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background-color:rgba(0, 0, 0, 0.95); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); z-index:2147483647; cursor:default;">
            
            <div id="ban-enforcer-message" style="position: fixed; bottom: 60px; left: 60px; color: #ffffff; font-family: 'Geist', sans-serif; z-index: 2147483647; text-align: left; text-shadow: 0 4px 12px rgba(0,0,0,0.5);">
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
            </div>

            <a href="../index.html" id="ban-enforcer-home-button" style="position: fixed; bottom: 60px; right: 60px; z-index: 2147483647; display: inline-flex; align-items: center; justify-content: center; padding: 0.5rem 1rem; background-color: transparent; border: 1px solid #333; border-radius: 0.75rem; color: #d1d5db; font-size: 20px; text-decoration: none; cursor: pointer; transition: all 0.2s; width: 50px; height: 50px;">
                <i class="fa-solid fa-house"></i>
            </a>

        </div>
    `;

    // 3. NUKE THE BODY CONTENT if not already done
    if (!document.getElementById('ban-enforcer-shield')) {
        document.body.innerHTML = banHTML;
        document.body.setAttribute('data-banned-nuke', 'true');
        
        // Add hover effects via JS since we replaced style tags
        const homeBtn = document.getElementById('ban-enforcer-home-button');
        if(homeBtn) {
            homeBtn.onmouseover = () => { homeBtn.style.backgroundColor = '#000'; homeBtn.style.borderColor = '#fff'; homeBtn.style.color = '#fff'; };
            homeBtn.onmouseout = () => { homeBtn.style.backgroundColor = 'transparent'; homeBtn.style.borderColor = '#333'; homeBtn.style.color = '#d1d5db'; };
        }

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
