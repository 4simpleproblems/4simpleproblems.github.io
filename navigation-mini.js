/**
 * navigation-mini.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information.
 *
 * --- FIXES/UPDATES ---
 * 1. Styling: Updated CSS to use pure black (#000000) for the navbar and dropdown menu.
 * 2. Icons: Added dynamic loading for Font Awesome.
 * 3. Logo: Increased size to h-10.
 * 4. Dropdown Buttons: Styled exactly like notes.html (darker hover, gap spacing).
 * 5. Retry Logic: Added a 5-second reload loop if the navbar fails to inject.
 * 6. NO GUEST LOGIN: Removed automatic anonymous sign-in.
 * 7. AVATAR FIX: Updated initial avatar to match navigation.js centering logic.
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
    authDomain: "project-zirconium.firebaseapp.com",
    projectId: "project-zirconium",
    storageBucket: "project-zirconium.firebasestorage.app",
    messagingSenderId: "1096564243475",
    appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
    measurementId: "G-1D4F692C1Q"
};
// =========================================================================

// --- Configuration ---
// This object defines the default "Dark" theme, containing only necessary properties for navigation-mini.js
const DEFAULT_THEME = {
    'avatar-gradient': 'linear-gradient(135deg, #374151 0%, #111827 100%)',
};

const PAGE_CONFIG_URL = '../page-identification.json'; // <--- NEW CONSTANT
const PINNED_PAGE_KEY = 'navbar_pinnedPage';
const PIN_BUTTON_HIDDEN_KEY = 'navbar_pinButtonHidden';
const THEME_STORAGE_KEY = 'user-navbar-theme'; // Added for compatibility
const lightThemeNames = ['Light', 'Lavender', 'Rose Gold', 'Mint']; // Added for compatibility

/**
 * NEW FUNCTION: applyCounterZoom
 * This calculates the browser's current zoom level (devicePixelRatio) and applies
 * an inverse scale transform to the navbar. This forces the navbar to appear the
 * same physical size regardless of zoom.
 */
const applyCounterZoom = () => {
    const navbar = document.querySelector('.auth-navbar');
    if (!navbar) return;

    // Get the current zoom ratio (e.g., 1.25 for 125% zoom)
    // Default to 1 if undefined
    const dpr = window.devicePixelRatio || 1;

    // Calculate inverse scale (e.g., 0.8 for 125% zoom)
    const scale = 1 / dpr;

    // Apply scale.
    // We use transform instead of 'zoom' property for better cross-browser support (Firefox)
    navbar.style.transform = `scale(${scale})`;
    
    // Compensate Width:
    // If we scale down to 0.5, the 100% width becomes 50% of screen.
    // We need to double the width to fill the screen again.
    navbar.style.width = `${dpr * 100}%`;
};


// --- Self-invoking function to encapsulate all logic ---
(function() {
    // Global references for Firebase objects and state
    let auth, db;
    let currentUser = null;
    let currentUserData = null;
    let allPages = {}; // <--- NEW GLOBAL VARIABLE

    // Stop execution if Firebase config is not provided
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) {
        console.error("Firebase configuration is missing! Please paste your config into navigation.js.");
        return;
    }

    // --- 1. DYNAMICALLY LOAD EXTERNAL ASSETS ---
    // Helper to load external JS files
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Helper to load external CSS files
    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = resolve; // Resolve even on error to not block the app
            document.head.appendChild(link);
        });
    };

    const getIconClass = (iconName) => {
        if (!iconName) return '';
        const nameParts = iconName.trim().split(/\s+/).filter(p => p.length > 0);
        let stylePrefix = 'fa-solid'; 
        const stylePrefixes = ['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands'];
        const existingPrefix = nameParts.find(p => stylePrefixes.includes(p));
        if (existingPrefix) stylePrefix = existingPrefix;
        const nameCandidate = nameParts.find(p => p.startsWith('fa-') && !stylePrefixes.includes(p));
        let baseName = '';
        if (nameCandidate) {
            baseName = nameCandidate;
        } else {
            baseName = nameParts.find(p => !stylePrefixes.includes(p));
            if (baseName && !baseName.startsWith('fa-')) baseName = `fa-${baseName}`;
        }
        if (baseName) return `${stylePrefix} ${baseName}`;
        return '';
    };

    const run = async () => {
        try {
            // Load Font Awesome 6.5.2 CSS - **WAIT FOR IT TO BE ADDED TO HEAD**
            await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");

            // Fetch page-identification.json
            try {
                const response = await fetch(PAGE_CONFIG_URL);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                allPages = await response.json();
            } catch (error) {
                console.error("Failed to load page identification config:", error);
                // Fallback if page-identification.json fails
                allPages = { 'home': { name: "Home", url: "../index.html", icon: "fa-solid fa-house" } };
            }
            
            // Sequentially load Firebase modules.
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            
            // Load Ban Enforcer (Must be after Firebase)
            await loadScript("ban-enforcer.js");

            // Now that scripts are loaded, we can use the `firebase` global object
            initializeApp(); // No longer passing pages here as allPages is global
            
            // We need to inject the styles and setup the container immediately
            // so the onAuthStateChanged listener can call renderNavbar successfully.
            injectStyles();
            setupContainer(); 
            
        } catch (error) {
            console.error("Failed to load necessary SDKs or Font Awesome:", error);
        }
    };

    // Helper to create the navbar container
    const setupContainer = () => {
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
    }


    // --- 2. INITIALIZE FIREBASE AND RENDER NAVBAR ---
    const initializeApp = () => {
        // Initialize Firebase with the compat libraries
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth(); // Assign to global reference
        db = firebase.firestore(); // Assign to global reference

        // Start the Auth listener immediately after initialization
        setupAuthListener();
        
        // Add PFP Update Listener
        window.addEventListener('pfp-updated', (e) => {
            if (!currentUserData) currentUserData = {};
            Object.assign(currentUserData, e.detail);
            
            const authToggle = document.getElementById('auth-toggle');
            if (authToggle) {
                const username = currentUserData.username || currentUser?.displayName || 'User';
                const initial = (currentUserData.letterAvatarText) ? currentUserData.letterAvatarText : username.charAt(0).toUpperCase();
                let newContent = '';
                
                if (currentUserData.pfpType === 'custom' && currentUserData.customPfp) {
                    newContent = `<img src="${currentUserData.customPfp}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                } else if (currentUserData.pfpType === 'mibi' && currentUserData.mibiConfig) {
                    const { eyes, mouths, hats, bgColor, rotation, size, offsetX, offsetY } = currentUserData.mibiConfig;
                    const scale = (size || 100) / 100;
                    const rot = rotation || 0;
                    const x = offsetX || 0;
                    const y = offsetY || 0;

                    newContent = `
                        <div class="w-full h-full relative overflow-hidden rounded-full" style="background-color: ${bgColor || '#3B82F6'}">
                             <div class="absolute inset-0 w-full h-full" style="transform: translate(${x}%, ${y}%) rotate(${rot}deg) scale(${scale}); transform-origin: center;">
                                 <img src="/mibi-avatars/head.png" class="absolute inset-0 w-full h-full object-contain">
                                 ${eyes ? `<img src="/mibi-avatars/eyes/${eyes}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                                 ${mouths ? `<img src="/mibi-avatars/mouths/${mouths}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                                 ${hats ? `<img src="/mibi-avatars/hats/${hats}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                             </div>
                        </div>
                    `;
                } else if (currentUserData.pfpType === 'letter') {
                    const bg = currentUserData.letterAvatarColor || DEFAULT_THEME['avatar-gradient']; // Default from navigation.js
                    const textColor = getLetterAvatarTextColor(bg);
                    const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                    newContent = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                } else {
                    // 'google' or fallback
                    const googleProvider = currentUser?.providerData.find(p => p.providerId === 'google.com');
                    const googlePhoto = googleProvider ? googleProvider.photoURL : null;
                    const displayPhoto = googlePhoto || currentUser?.photoURL;

                    if (displayPhoto) {
                        newContent = `<img src="${displayPhoto}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                    } else {
                        const bg = DEFAULT_THEME['avatar-gradient']; // Default from navigation.js
                        const textColor = getLetterAvatarTextColor(bg);
                        const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                        newContent = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                    }
                }

                // Fade animation
                authToggle.style.transition = 'opacity 0.2s ease';
                authToggle.style.opacity = '0';
                setTimeout(() => {
                    authToggle.innerHTML = newContent;
                    authToggle.style.opacity = '1';
                }, 200);
                
                // Update Dropdown Menu Avatar (if open or exists)
                const menuAvatar = document.getElementById('auth-menu-avatar-container');
                if (menuAvatar) {
                    menuAvatar.innerHTML = newContent;
                }
            }
        });
    };

    // --- 3. INJECT CSS STYLES (UPDATED) ---
    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            body { padding-top: 4rem; /* 64px, equal to navbar height */ }
            
            .auth-navbar { 
                position: fixed; top: 0; left: 0; right: 0; z-index: 1000; 
                /* UPDATED: transform-origin ensures scaling happens from top-left corner */
                transform-origin: top left;
                background: #000000; /* Pure Black */
                border-bottom: 1px solid rgb(31 41 55); height: 4rem; 
            }
            
            .auth-navbar nav { padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; }
            
                        .auth-menu-container { 
                            position: absolute; right: 0; top: 50px; width: 16rem; 
                            background: #000000; /* Pure Black */
                            backdrop-filter: none;
                            -webkit-backdrop-filter: none;
                            border: 1px solid rgb(55 65 81); border-radius: 0.9rem; padding: 0.75rem; 
                            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2);
                            transition: transform 0.2s ease-out, opacity 0.2s ease-out; transform-origin: top right; 
                        }
                        .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
                        .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }
            
                        .initial-avatar { background: linear-gradient(135deg, #374151 0%, #111827 100%); font-family: 'Geist', sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white; }
            
                                    /* Auth Menu Username and Email Styling */
                                    .auth-menu-username {
                                        text-align: left !important;
                                        margin: 0 !important;
                                        font-weight: 400 !important;
                                    }
                                    .auth-menu-email {
                                        text-align: left !important;
                                        margin: 0 !important;
                                        font-weight: 400 !important;
                                    }            /* * UPDATED STYLE: Matches 'dropdown-item' from notes.html 
             * Using flex gap instead of margin-right on icons.
             * Darker hover background (#2a2a2a).
             */
            .auth-menu-link, .auth-menu-button { 
                display: flex;
                align-items: center; 
                gap: 10px; /* Matches notes.html */
                width: 100%; text-align: left; 
                padding: 0.5rem 0.75rem; 
                font-size: 0.875rem; 
                color: #d1d5db; 
                border-radius: 0.375rem; 
                transition: background-color 0.15s, color 0.15s; 
                border: none;
                cursor: pointer;
                text-decoration: none;
            }
            
            .auth-menu-link:hover, .auth-menu-button:hover { 
                background-color: #2a2a2a; /* Matches notes.html hover */
                color: #ffffff; 
            }

            /* New custom style for the logged out button's icon and background */
            .logged-out-auth-toggle {
                background: #010101; 
                border: 1px solid #374151; 
            }
            .logged-out-auth-toggle i {
                color: #DADADA; 
            }

            /* --- Marquee Styles --- */
            .marquee-container {
                overflow: hidden;
                white-space: nowrap;
                position: relative;
                max-width: 100%;
            }
            
            /* Only apply mask and animation when active */
            .marquee-container.active {
                mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
                -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%);
            }
            
            .marquee-content {
                display: inline-block;
                white-space: nowrap;
            }
            
            .marquee-container.active .marquee-content {
                animation: marquee 10s linear infinite;
                /* Make sure there is enough width for the scroll */
                min-width: 100%; 
            }
            
            @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); } /* Move half way (since content is duplicated) */
            }
        `;
        document.head.appendChild(style);
    };

    // --- NEW HELPER: CONDITIONAL LINKS ---
    /**
     * Generates HTML for the optional links, hiding them if the user is on that page.
     * @param {string} currentPage The current window.location.pathname.
     * @returns {string} The HTML string for the links.
     */
    const getOptionalLinks = (currentPage) => {
        let links = '';
        const normalizePath = (path) => path.replace(/^\/+/, '').toLowerCase();
        const currentPath = normalizePath(currentPage);

        // 1. Authenticate Link
        if (!currentPath.includes('authentication.html')) {
             links += `<a href="/authentication.html" class="auth-menu-link"><i class="fa-solid fa-lock w-5"></i>Authenticate</a>`;
        }

        // 2. Documentation Link
        if (!currentPath.includes('documentation.html')) {
            links += `<a href="/documentation.html" class="auth-menu-link"><i class="fa-solid fa-book w-5"></i>Documentation</a>`;
        }
        
        // 3. Terms & Policies Link (Assumes file is named legal.html)
        if (!currentPath.includes('legal.html')) {
            links += `<a href="/legal.html" class="auth-menu-link"><i class="fa-solid fa-gavel w-5"></i>Terms & Policies</a>`;
        }

        // 4. Donate Link (Always visible, opens in new tab)
        links += `<a href="https://buymeacoffee.com/4simpleproblems" target="_blank" class="auth-menu-link"><i class="fa-solid fa-mug-hot w-5"></i>Donate</a>`;
        
        return links;
    }


    // --- NEW HELPER: COLOR UTILITIES FOR LETTER AVATAR ---
    /**
     * Helper: Converts a hex color string to an RGB object.
     * @param {string} hex - The hex color string (e.g., "#RRGGBB" or "#RGB").
     * @returns {object} An object {r, g, b} or null if invalid.
     */
    const hexToRgb = (hex) => {
        if (!hex || typeof hex !== 'string') return null;
        let c = hex.substring(1); // Remove #
        if (c.length === 3) {
            c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        if (c.length !== 6) return null;
        const num = parseInt(c, 16);
        return {
            r: (num >> 16) & 0xFF,
            g: (num >> 8) & 0xFF,
            b: (num >> 0) & 0xFF
        };
    };

    /**
     * Helper: Calculates the relative luminance of an RGB color.
     * @param {object} rgb - An object {r, g, b}.
     * @returns {number} The luminance (0.0 to 1.0).
     */
    const getLuminance = (rgb) => {
        if (!rgb) return 0;
        const a = [rgb.r, rgb.g, rgb.b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    };

    /**
     * Helper: Determines a contrasting text color (dark or white) for a given background gradient.
     * For saturated colors, it tries to provide a darker shade of the color, otherwise white.
     * @param {string} gradientBg - The CSS linear-gradient string.
     * @returns {string} A hex color string (e.g., "#000000" or "#FFFFFF" or darker shade).
     */
    const getLetterAvatarTextColor = (gradientBg) => {
        if (!gradientBg) return '#FFFFFF'; // Default to white for safety

        // Extract the first color from the gradient string
        const match = gradientBg.match(/#([0-9a-fA-F]{3}){1,2}/);
        const firstHexColor = match ? match[0] : null;

        if (!firstHexColor) return '#FFFFFF'; // Fallback if no hex color found

        const rgb = hexToRgb(firstHexColor);
        if (!rgb) return '#FFFFFF';

        const luminance = getLuminance(rgb);

        // If background is bright, provide a darker version of the color.
        // If background is dark, use white.
        // Threshold 0.5 is subjective, adjust as needed.
        if (luminance > 0.5) { 
            // Darken the color by reducing RGB values
            // A simple darkening: reduce R, G, B by a factor
            const darkenFactor = 0.5; // Reduce lightness by 50%
            const darkerR = Math.floor(rgb.r * darkenFactor);
            const darkerG = Math.floor(rgb.g * darkenFactor);
            const darkerB = Math.floor(rgb.b * darkenFactor);
            
            // Convert back to hex
            return `#${((1 << 24) + (darkerR << 16) + (darkerG << 8) + darkerB).toString(16).slice(1)}`;
        } else {
            return '#FFFFFF';
        }
    };

    // --- NEW: Check Marquees Helper ---
    const checkMarquees = () => {
        requestAnimationFrame(() => {
            const containers = document.querySelectorAll('.marquee-container');
            containers.forEach(container => {
                const content = container.querySelector('.marquee-content');
                if (!content) return;

                container.classList.remove('active');
                if (content.nextElementSibling && content.nextElementSibling.classList.contains('marquee-content')) {
                    content.nextElementSibling.remove();
                }

                if (content.offsetWidth > container.offsetWidth) {
                    container.classList.add('active');
                    const duplicate = content.cloneNode(true);
                    duplicate.setAttribute('aria-hidden', 'true');
                    content.style.paddingRight = '2rem'; 
                    duplicate.style.paddingRight = '2rem';
                    container.appendChild(duplicate);
                } else {
                    content.style.paddingRight = '';
                }
            });
        });
    };

    const getMiniPinButtonHtml = () => {
        // Only show pin button if user is logged in
        if (!currentUser) return ''; // <--- ADD THIS CHECK

        const pinnedPageKey = localStorage.getItem(PINNED_PAGE_KEY);
        const isPinButtonHidden = localStorage.getItem(PIN_BUTTON_HIDDEN_KEY) === 'true';

        // Only show pin button if a page is pinned and it's not hidden
        if (!pinnedPageKey || isPinButtonHidden) return '';
        
        // Use allPages to get the correct icon and URL
        const pinnedPageData = allPages[pinnedPageKey];
        if (!pinnedPageData) {
            console.warn(`Pinned page data not found for key: ${pinnedPageKey}`);
            return ''; // Don't show if data is missing
        }

        const pinButtonIcon = getIconClass(pinnedPageData.icon);
        const pinButtonUrl = pinnedPageData.url; 
        const pinButtonTitle = `Go to ${pinnedPageData.name}`;

        return `
            <div id="mini-pin-area-wrapper" class="relative flex-shrink-0 flex items-center">
                <a href="${pinButtonUrl}" id="mini-pin-button" class="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center hover:bg-gray-700 transition" title="${pinButtonTitle}">
                    <i class="${pinButtonIcon}"></i>
                </a>
            </div>
        `;
    }

    const updatePinButtonArea = () => {
        const pinWrapper = document.getElementById('mini-pin-area-wrapper');
        const newPinHtml = getMiniPinButtonHtml();
        const authButtonContainer = document.getElementById('auth-controls-wrapper-mini');

        if (pinWrapper) {
            if (newPinHtml === '') {
                pinWrapper.remove();
            } else {
                pinWrapper.outerHTML = newPinHtml;
            }
        } else if (authButtonContainer && newPinHtml !== '') {
            // Prepend if the auth button container exists and we have a button to show
            authButtonContainer.insertAdjacentHTML('afterbegin', newPinHtml);
        }
    };

    // --- 4. RENDER THE NAVBAR HTML (UPDATED) ---
    const renderNavbar = (user, userData) => {
        const container = document.getElementById('navbar-container');
        if (!container) return; // Should not happen if setupContainer runs

        const logoPath = "/images/logo-christmas.png"; // Using root-relative path
        const currentPagePath = window.location.pathname; // Get current path for conditional links

        // UPDATED: Use a function to render the conditional links
        const loggedOutView = (currentPage) => {
            const optionalLinks = getOptionalLinks(currentPage);

            return `
                <div class="relative">
                    <button id="auth-toggle" class="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                        <i class="fa-solid fa-user"></i>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        ${optionalLinks}
                    </div>
                </div>
            `;
        }

        const loggedInView = (user, userData) => {
            const username = userData?.username || user.displayName || 'User';
            const email = user.email || 'No email';
            const initial = (userData?.letterAvatarText || username.charAt(0)).toUpperCase();

            // Determine if a light theme is active
            let currentTheme = null;
            try {
                currentTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
            } catch (e) {
                console.warn("Could not parse saved theme in navigation-mini.js.");
            }
            const isLightTheme = currentTheme && lightThemeNames.includes(currentTheme.name);

            const usernameTextColorClass = isLightTheme ? 'text-black' : 'text-white';
            const emailTextColorClass = isLightTheme ? 'text-gray-700' : 'text-gray-400'; // Near black/dark grey

            // --- NEW PROFILE PICTURE LOGIC ---
            let avatarHtml = '';
            const pfpType = userData?.pfpType || 'google'; // Default to 'google'

            if (pfpType === 'custom' && userData?.customPfp) {
                avatarHtml = `<img src="${userData.customPfp}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
            } else if (pfpType === 'mibi' && userData?.mibiConfig) {
                const { eyes, mouths, hats, bgColor, rotation, size, offsetX, offsetY } = userData.mibiConfig;
                const scale = (size || 100) / 100;
                const rot = rotation || 0;
                const x = offsetX || 0;
                const y = offsetY || 0;
                
                avatarHtml = `
                    <div class="w-full h-full relative overflow-hidden rounded-full" style="background-color: ${bgColor || '#3B82F6'}">
                            <div class="absolute inset-0 w-full h-full" style="transform: translate(${x}%, ${y}%) rotate(${rot}deg) scale(${scale}); transform-origin: center;">
                                <img src="/mibi-avatars/head.png" class="absolute inset-0 w-full h-full object-contain">
                                ${eyes ? `<img src="/mibi-avatars/eyes/${eyes}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                                ${mouths ? `<img src="/mibi-avatars/mouths/${mouths}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                                ${hats ? `<img src="/mibi-avatars/hats/${hats}" class="absolute inset-0 w-full h-full object-contain">` : ''}
                            </div>
                    </div>
                `;
            } else if (pfpType === 'letter') {
                const bg = userData?.pfpLetterBg || DEFAULT_THEME['avatar-gradient']; // Default from navigation.js
                const textColor = getLetterAvatarTextColor(bg); // Use new helper
                const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base'); // Dynamic font size

                avatarHtml = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
            } else {
                // 'google' or fallback
                // Try to find specific Google photo first if available in providerData
                const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
                const googlePhoto = googleProvider ? googleProvider.photoURL : null;
                const displayPhoto = googlePhoto || user.photoURL;

                if (displayPhoto) {
                    avatarHtml = `<img src="${displayPhoto}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                } else {
                    // Fallback to standard letter avatar
                    const bg = 'linear-gradient(135deg, #374151 0%, #111827 100%)'; // Default from navigation.js
                    const textColor = getLetterAvatarTextColor(bg);
                    const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                    avatarHtml = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                }
            }
            // --- END NEW LOGIC ---

            return `
                ${getMiniPinButtonHtml()}
                <div class="relative">
                    <button id="auth-toggle" class="w-10 h-10 rounded-full border border-gray-600 overflow-hidden flex items-center justify-center">
                        ${avatarHtml}
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed">
                        <div class="border-b border-gray-700 mb-2 flex items-center">
                            <div class="min-w-0 flex-1 overflow-hidden">
                                <div class="marquee-container" id="username-marquee">
                                    <p class="text-sm font-semibold ${usernameTextColorClass} auth-menu-username marquee-content">${username}</p>
                                </div>
                                <div class="marquee-container" id="email-marquee">
                                    <p class="text-xs ${emailTextColorClass} auth-menu-email marquee-content">${email}</p>
                                </div>
                            </div>
                        </div>
                        <a href="/logged-in/dashboard.html" class="auth-menu-link"><i class="fa-solid fa-house-chimney-user w-5"></i>Dashboard</a>
                        <a href="/logged-in/settings.html" class="auth-menu-link"><i class="fa-solid fa-gear w-5"></i>Settings</a>
                        <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300"><i class="fa-solid fa-right-from-bracket w-5"></i>Log Out</button>
                        <a href="/legal.html" class="auth-menu-link"><i class="fa-solid fa-gavel w-5"></i>Terms & Policies</a>

                    </div>
                </div>
            `;
        };

        // UPDATED: Logo image class changed from h-8 to h-10 for slightly larger size
        container.innerHTML = `
            <header class="auth-navbar">
                <nav>
                    <a href="/" class="flex items-center space-x-2">
                        <img src="${logoPath}" alt="4SP Logo" class="h-10 w-auto">
                    </a>
                    <div id="auth-controls-wrapper-mini" class="flex items-center gap-3 flex-shrink-0">
                        ${user ? loggedInView(user, userData) : loggedOutView(currentPagePath)}
                    </div>
                </nav>
            </header>
        `;

        // Apply Counter Zoom immediately on creation
        applyCounterZoom();

        // --- 5. SETUP EVENT LISTENERS ---
        setupEventListeners(user);
        
        // --- NEW: Init Marquees ---
        checkMarquees();
    };

    const setupEventListeners = (user) => {
        const toggleButton = document.getElementById('auth-toggle');
        const menu = document.getElementById('auth-menu-container');

        if (toggleButton && menu) {
            toggleButton.addEventListener('click', (e) => {
                e.stopPropagation();
                menu.classList.toggle('closed');
                menu.classList.toggle('open');
                
                if (menu.classList.contains('open')) {
                    checkMarquees();
                }
            });
        }

        document.addEventListener('click', (e) => {
            if (menu && menu.classList.contains('open') && !menu.contains(e.target) && e.target !== toggleButton) {
                menu.classList.add('closed');
                menu.classList.remove('open');
            }
        });

        if (user) {
            const logoutButton = document.getElementById('logout-button');
            if (logoutButton) {
                // Use the globally available 'auth' reference
                logoutButton.addEventListener('click', () => {
                    auth.signOut().catch(err => console.error("Logout failed:", err));
                });
            }
        }
        // --- MODIFIED: RESIZE EVENT ---
        // We now trigger both glider updates AND the counter-zoom logic
        window.addEventListener('resize', () => {
            applyCounterZoom(); // Re-calculate zoom scale on resize
        });
        // --- END MODIFICATION ---
    };


    // --- 6. AUTH STATE LISTENER (MODIFIED) ---
    const setupAuthListener = () => {
        auth.onAuthStateChanged(async (user) => {
            currentUser = user; // Update global var
            if (user) {
                // User is signed in. Fetch their data from Firestore.
                try {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    currentUserData = userDoc.exists ? userDoc.data() : null; // Update global var
                    renderNavbar(user, currentUserData);
                    updatePinButtonArea(); // <--- ADD THIS LINE
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    renderNavbar(user, null); // Render even if Firestore fails
                    updatePinButtonArea(); // <--- ADD THIS LINE (also for error case)
                }
            } else {
                // User is signed out.
                currentUserData = null;
                renderNavbar(null, null);
                updatePinButtonArea(); // <--- ADD THIS LINE
            }

            // --- START: Injection failure retry logic ---
            // Give the DOM a moment to update after renderNavbar
            setTimeout(() => {
                const container = document.getElementById('navbar-container');
                // Check if rendering failed (container is empty or only has whitespace)
                if (!container || !container.innerHTML.trim()) {
                    console.warn("Navbar injection failed. Starting 5-second retry loop...");
                    const startTime = Date.now();
                    
                    const retryInterval = setInterval(() => {
                        const containerNow = document.getElementById('navbar-container');
                        
                        // Stop if 5 seconds have passed
                        if (Date.now() - startTime > 5000) {
                            clearInterval(retryInterval);
                            console.error("Navbar retry failed after 5 seconds. Stopping.");
                            return;
                        }
                        
                        // Stop if injection succeeded
                        if (containerNow && containerNow.innerHTML.trim()) {
                             clearInterval(retryInterval);
                             console.log("Navbar injection succeeded on retry.");
                             return;
                        }
                        
                        // If still failed, "spam reload"
                        console.log("Retrying navbar load...");
                        location.reload(true); // Force reload from server

                    }, 500); // Retry every 500ms
                }
            }, 250); // Wait 250ms for render to complete
            // --- END: Injection failure retry logic ---

        });
    }

    // --- START THE PROCESS ---
    // Wait for the DOM to be ready, then start loading scripts.
    document.addEventListener('DOMContentLoaded', run);

})();
