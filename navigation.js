/**
 * navigation-test.js
 * * This is a fully self-contained script to create a dynamic, authentication-aware
 * navigation bar for your website. It handles everything from Firebase initialization
 * to rendering user-specific information. It now includes a horizontally scrollable
 * tab menu loaded from page-identification.json.
 *
 * --- UPDATES & FEATURES ---
 * ... [Previous changelog kept] ...
 * 27. **(NEW) COUNTER-ZOOM LOGIC:** The navbar now detects browser zoom/DPI changes 
 * and inversely scales itself to maintain a consistent physical size on screen, 
 * regardless of the browser's zoom level.
 */

// =========================================================================
// >> ACTION REQUIRED: PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE <<
// =========================================================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAZBKAckVa4IMvJGjcyndZx6Y1XD52lgro",
    authDomain: "project-zirconium.firebaseapp.com",
    projectId: "project-zirconium",
    storageBucket: "project-zirconium.firebaseapp.com",
    messagingSenderId: "1096564243475",
    appId: "1:1096564243475:web:6d0956a70125eeea1ad3e6",
    measurementId: "G-1D4F692C1Q"
};
// =========================================================================

// --- Configuration ---
const PAGE_CONFIG_URL = '../page-identification.json';
const PRIVILEGED_EMAIL = '4simpleproblems@gmail.com'; 
const THEME_STORAGE_KEY = 'user-navbar-theme';
const lightThemeNames = ['Light', 'Lavender', 'Rose Gold', 'Mint', 'Pink']; // Define light theme names

const DEFAULT_THEME = {
    'name': 'Dark', // <--- ADD THIS LINE
    'logo-src': '/images/logo.png', 
    'navbar-bg': '#000000',
    'navbar-border': 'rgb(31 41 55)',
    'avatar-gradient': 'linear-gradient(135deg, #374151 0%, #111827 100%)',
    'avatar-border': '#4b5563',
    'menu-bg': '#000000',
    'menu-border': 'rgb(55 65 81)',
    'menu-divider': '#374151',
    'menu-text': '#d1d5db',
    'menu-username-text': '#ffffff', 
    'menu-email-text': '#9ca3af', // NEW: Default email text color 
    'menu-item-hover-bg': 'rgb(55 65 81)', 
    'menu-item-hover-text': '#ffffff',
    'glass-menu-bg': 'rgba(10, 10, 10, 0.8)',
    'glass-menu-border': 'rgba(55, 65, 81, 0.8)',
    'logged-out-icon-bg': '#010101',
    'logged-out-icon-border': '#374151',
    'logged-out-icon-color': '#DADADA',
    'glide-icon-color': '#ffffff',
    'glide-gradient-left': 'linear-gradient(to right, #000000, transparent)',
    'glide-gradient-right': 'linear-gradient(to left, #000000, transparent)',
    'tab-text': '#9ca3af',
    'tab-hover-text': '#ffffff',
    'tab-hover-border': '#d1d5db',
    'tab-hover-bg': 'rgba(79, 70, 229, 0.05)',
    'tab-active-text': '#4f46e5',
    'tab-active-border': '#4f46e5',
    'tab-active-bg': 'rgba(79, 70, 229, 0.1)',
    'tab-active-hover-text': '#6366f1',
    'tab-active-hover-border': '#6366f1',
    'tab-active-hover-bg': 'rgba(79, 70, 229, 0.15)',
    'pin-btn-border': '#4b5563',
    'pin-btn-hover-bg': '#374151',
    'pin-btn-icon-color': '#d1d5db',
    'hint-bg': '#010101',
    'hint-border': '#374151',
    'hint-text': '#ffffff'
};

window.applyTheme = (theme) => {
    const root = document.documentElement;
    if (!root) return;
    const themeToApply = theme && typeof theme === 'object' ? theme : DEFAULT_THEME;
    
    // Determine if it's a light theme
    const isLightTheme = lightThemeNames.includes(themeToApply.name);

    for (const [key, value] of Object.entries(themeToApply)) {
        if (key !== 'logo-src' && key !== 'name') {
            root.style.setProperty(`--${key}`, value);
        }
    }

    // Apply specific colors for light themes
    if (isLightTheme) {
        root.style.setProperty('--menu-username-text', '#000000'); // Black for username
        root.style.setProperty('--menu-email-text', '#333333');   // Dark grey for email
    } else {
        // Revert to theme's default or global default
        root.style.setProperty('--menu-username-text', themeToApply['menu-username-text'] || DEFAULT_THEME['menu-username-text']);
        root.style.setProperty('--menu-email-text', themeToApply['menu-email-text'] || DEFAULT_THEME['menu-email-text']);
    }

    const logoImg = document.getElementById('navbar-logo');
    if (logoImg) {
        let newLogoSrc;
        if (themeToApply.name === 'Christmas') {
            newLogoSrc = '/images/logo-christmas.png';
        } else {
            newLogoSrc = themeToApply['logo-src'] || DEFAULT_THEME['logo-src'];
        }
        const currentSrc = logoImg.src;
        const expectedSrc = new URL(newLogoSrc, window.location.origin).href;
        if (currentSrc !== expectedSrc) {
            logoImg.src = newLogoSrc;
        }

        // --- NEW: Logo Tinting Logic ---
const noFilterThemes = ['Dark', 'Light', 'Christmas'];

if (noFilterThemes.includes(themeToApply.name)) {
    // Reset styles for themes that don't need tinting
    logoImg.style.filter = ''; 
    logoImg.style.transform = '';
} else {
    // 1. Get the highlight color from the theme (e.g., the tab text color)
    // You can choose 'navbar-border' or 'tab-active-text' depending on preference
    const tintColor = themeToApply['tab-active-text'] || '#ffffff';

    // 2. Create a colored shadow 100px to the right, and move the actual image 100px to the left
    // This hides the white image and shows only the colored shadow
    logoImg.style.filter = `drop-shadow(100px 0 0 ${tintColor})`;
    logoImg.style.transform = 'translateX(-100px)';
}
// --- END NEW: Logo Tinting Logic ---
    }
};

let auth;
let db;

(function() {
    const loadScript = (src) => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    const loadCSS = (href) => {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            document.head.appendChild(link);
        });
    };

    const debounce = (func, delay) => {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    };
    
    const getIconClass = (iconName) => {
        if (!iconName) return '';
        const nameParts = iconName.trim().split(/\s+/).filter(p => p.length > 0);
        let stylePrefix = 'fa-solid'; 
        let baseName = '';
        const stylePrefixes = ['fa-solid', 'fa-regular', 'fa-light', 'fa-thin', 'fa-brands'];
        const existingPrefix = nameParts.find(p => stylePrefixes.includes(p));
        if (existingPrefix) stylePrefix = existingPrefix;
        const nameCandidate = nameParts.find(p => p.startsWith('fa-') && !stylePrefixes.includes(p));
        if (nameCandidate) {
            baseName = nameCandidate;
        } else {
            baseName = nameParts.find(p => !stylePrefixes.includes(p));
            if (baseName && !baseName.startsWith('fa-')) baseName = `fa-${baseName}`;
        }
        if (baseName) return `${stylePrefix} ${baseName}`;
        return '';
    };

    const isTabActive = (tabUrl, aliases) => {
        const currentPathname = window.location.pathname.toLowerCase();
        
        const cleanPath = (path) => {
            try {
                // If it's a relative path, resolve it against origin
                const resolved = new URL(path, window.location.origin).pathname.toLowerCase();
                // Normalize index.html
                if (resolved.endsWith('/index.html')) return resolved.substring(0, resolved.lastIndexOf('/')) + '/';
                if (resolved.length > 1 && resolved.endsWith('/')) return resolved.slice(0, -1);
                return resolved;
            } catch (e) {
                return path; // Fallback for invalid URLs
            }
        };

        const currentCanonical = cleanPath(currentPathname);
        
        // 1. Check primary URL
        const tabCanonical = cleanPath(tabUrl);
        if (currentCanonical === tabCanonical) return true;

        // 2. Check suffix matching (existing logic)
        const tabPathSuffix = new URL(tabUrl, window.location.origin).pathname.toLowerCase();
        const tabSuffixClean = tabPathSuffix.startsWith('/') ? tabPathSuffix.substring(1) : tabPathSuffix;
        // Avoid aggressive suffix matching for root/short paths
        if (tabSuffixClean.length > 3 && currentPathname.endsWith(tabSuffixClean)) return true;

        // 3. Check Aliases (NEW)
        if (aliases && Array.isArray(aliases)) {
            for (const alias of aliases) {
                const aliasCanonical = cleanPath(alias);
                if (currentCanonical === aliasCanonical) return true;
                
                // Also check alias suffixes if needed, though exact path matching is safer
                const aliasPathSuffix = new URL(alias, window.location.origin).pathname.toLowerCase();
                 const aliasSuffixClean = aliasPathSuffix.startsWith('/') ? aliasPathSuffix.substring(1) : aliasPathSuffix;
                if (aliasSuffixClean.length > 3 && currentPathname.endsWith(aliasSuffixClean)) return true;
            }
        }

        return false;
    };

    const run = async () => {
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        
        injectStyles();

        const container = document.getElementById('navbar-container');
        const logoPath = DEFAULT_THEME['logo-src']; 
        container.innerHTML = `
            <header class="auth-navbar">
                <nav>
                    <a href="/" class="flex items-center space-x-2 flex-shrink-0 overflow-hidden relative">
                        <img src="${logoPath}" alt="4SP Logo" class="h-10 w-auto" id="navbar-logo">
                    </a>
                    <div class="tab-wrapper">
                        <div class="tab-scroll-container flex justify-center items-center overflow-hidden">
                            <div class="nav-tab-placeholder"></div>
                            <div class="nav-tab-placeholder hidden sm:block"></div>
                            <div class="nav-tab-placeholder hidden md:block"></div>
                        </div>
                    </div>
                    <div id="auth-controls-wrapper" class="flex items-center gap-3 flex-shrink-0">
                        <div class="auth-toggle-placeholder"></div>
                    </div>
                </nav>
            </header>
        `;

        // --- NEW: Apply Counter Zoom immediately on creation ---
        applyCounterZoom();

        let pages = {};
        await loadCSS("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css");
        
        try {
            const response = await fetch(PAGE_CONFIG_URL);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            pages = await response.json();
        } catch (error) {
            console.error("Failed to load page identification config:", error);
            pages = { 'home': { name: "Home", url: "../index.html", icon: "fa-solid fa-house" } };
        }

        try {
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js");
            await loadScript("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js");
            initializeApp(pages, FIREBASE_CONFIG);
        } catch (error) {
            console.error("Failed to load core Firebase SDKs:", error);
            renderNavbar(null, null, pages, false);
        }
    };

    const injectStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* Base Styles */
            body { padding-top: 64px; }
            .auth-navbar {
                position: fixed; top: 0; left: 0; 
                /* UPDATED: transform-origin ensures scaling happens from top-left corner */
                transform-origin: top left;
                z-index: 1000;
                background: var(--navbar-bg);
                border-bottom: 1px solid var(--navbar-border);
                height: 64px;
                transition: background-color 0.3s ease, border-color 0.3s ease;
                /* Width is handled dynamically by applyCounterZoom now */
                width: 100%; 
            }
            .auth-navbar nav { padding: 0 1rem; height: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1rem; position: relative; }
            .initial-avatar {
                background: var(--avatar-gradient);
                font-family: sans-serif; text-transform: uppercase; display: flex; align-items: center; justify-content: center; color: white;
            }
            #auth-toggle {
                border-color: var(--avatar-border);
                transition: border-color 0.3s ease;
            }

            /* Auth Dropdown Menu Styles */
            .auth-menu-container {
                position: absolute; right: 0; top: 50px; width: 16rem;
                background: var(--menu-bg);
                border: 1px solid var(--menu-border);
                border-radius: 0.9rem; padding: 0.75rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4), 0 4px 6px -2px rgba(0,0,0,0.2);
                transition: transform 0.2s ease-out, opacity 0.2s ease-out, background-color 0.3s ease, border-color 0.3s ease;
                transform-origin: top right; z-index: 1010;
            }
            .auth-menu-container .border-b { border-color: var(--menu-divider) !important; transition: border-color 0.3s ease; }
            .auth-menu-username {
                color: var(--menu-username-text);
                transition: color 0.3s ease;
                text-align: left !important; margin: 0 !important; font-weight: 400 !important;
            }
            .auth-menu-email { color: var(--menu-email-text); text-align: left !important; margin: 0 !important; font-weight: 400 !important; }
            .auth-menu-container.open { opacity: 1; transform: translateY(0) scale(1); }
            .auth-menu-container.closed { opacity: 0; pointer-events: none; transform: translateY(-10px) scale(0.95); }

            .auth-menu-more-section { display: none; padding-top: 0.5rem; margin-top: 0.5rem; border-top: 1px solid var(--menu-divider); }

            .auth-menu-link, .auth-menu-button { 
                display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; 
                padding: 0.5rem 0.75rem; font-size: 0.875rem; color: var(--menu-text); border-radius: 0.7rem; 
                transition: background-color 0.15s, color 0.15s; border: none; cursor: pointer;
            }
            .auth-menu-link:hover, .auth-menu-button:hover { background-color: var(--menu-item-hover-bg); color: var(--menu-item-hover-text); }

            .logged-out-auth-toggle { 
                background: var(--logged-out-icon-bg); border: 1px solid var(--logged-out-icon-border); 
                transition: background-color 0.3s ease, border-color 0.3s ease;
            }
            .logged-out-auth-toggle i { color: var(--logged-out-icon-color); transition: color 0.3s ease; }

            .glass-menu { 
                background: var(--glass-menu-bg); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); 
                border: 1px solid var(--glass-menu-border); transition: background-color 0.3s ease, border-color 0.3s ease;
            }
            .auth-menu-link i.w-4, .auth-menu-button i.w-4 { width: 1rem; text-align: center; } 

            .tab-wrapper { flex-grow: 1; display: flex; align-items: center; position: relative; min-width: 0; margin: 0 1rem; justify-content: center; }
            .tab-scroll-container { 
                flex-grow: 1; display: flex; align-items: center; 
                overflow-x: auto; -webkit-overflow-scrolling: touch; 
                scrollbar-width: none; -ms-overflow-style: none; 
                padding-bottom: 5px; margin-bottom: -5px; scroll-behavior: smooth;
                max-width: 100%; padding-left: 16px; padding-right: 16px; 
            }
            .tab-scroll-container::-webkit-scrollbar { display: none; }
            .scroll-glide-button {
                position: absolute; top: 0; height: 100%; width: 64px; display: flex; align-items: center; justify-content: center; 
                color: var(--glide-icon-color); font-size: 1.2rem; cursor: pointer; opacity: 1; 
                transition: opacity 0.3s, color 0.3s ease; z-index: 10; pointer-events: auto;
            }
            #glide-left { 
                left: 0; background: var(--glide-gradient-left); justify-content: flex-start; padding-left: 8px; 
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease;
            }
            #glide-right { 
                right: 0; background: var(--glide-gradient-right); justify-content: flex-end; padding-right: 8px; 
                transition: opacity 0.3s, color 0.3s ease, background 0.3s ease;
            }
            .scroll-glide-button.hidden { opacity: 0 !important; pointer-events: none !important; }
            
            .nav-tab { 
                flex-shrink: 0; padding: 8px 12px; color: var(--tab-text); 
                font-size: 0.875rem; font-weight: 500; border-radius: 0.7rem; 
                transition: all 0.2s, color 0.3s ease, border-color 0.3s ease, background-color 0.3s ease; 
                text-decoration: none; line-height: 1.5; display: flex; align-items: center; margin-right: 8px; 
                border: 1px solid transparent; 
            }
            .nav-tab:not(.active):hover { color: var(--tab-hover-text); border-color: var(--tab-hover-border); background-color: var(--tab-hover-bg); }
            .nav-tab.active { color: var(--tab-active-text); border-color: var(--tab-active-border); background-color: var(--tab-active-bg); }
            .nav-tab.active:hover { color: var(--tab-active-hover-text); border-color: var(--tab-active-hover-border); background-color: var(--tab-active-hover-bg); }
            
            #pin-button { border-color: var(--pin-btn-border); transition: background-color 0.2s, border-color 0.3s ease; display: flex; align-items: center; justify-content: center; }
            #pin-button:hover { background-color: var(--pin-btn-hover-bg); }
            #pin-button-icon { color: var(--pin-btn-icon-color); transition: color 0.3s ease; }

            .pin-hint-container {
                position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%) scale(0.8);
                background: var(--hint-bg); border: 1px solid var(--hint-border); color: var(--hint-text);
                padding: 0.5rem 1rem; border-radius: 0.9rem; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
                opacity: 0; pointer-events: none; z-index: 1020;
                transition: opacity 0.3s ease, transform 0.3s ease, background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
                white-space: nowrap; font-size: 0.875rem;
            }
            .pin-hint-container.show { opacity: 1; transform: translateX(-50%) scale(1); transition-delay: 0.2s; }

            .marquee-container { overflow: hidden; white-space: nowrap; position: relative; max-width: 100%; }
            .marquee-container.active { mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%); -webkit-mask-image: linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%); }
            .marquee-content { display: inline-block; white-space: nowrap; }
            .marquee-container.active .marquee-content { animation: marquee 10s linear infinite; min-width: 100%; }
            @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        `;
        document.head.appendChild(style);
    };

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

    const initializeApp = (pages, firebaseConfig) => {
        if (!document.getElementById('navbar-container')) {
            const navbarDiv = document.createElement('div');
            navbarDiv.id = 'navbar-container';
            document.body.prepend(navbarDiv);
        }
        
        injectStyles();
        
        let savedTheme;
        try {
            savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
        } catch (e) {
            savedTheme = null;
            console.warn("Could not parse saved theme from Local Storage.");
        }
        window.applyTheme(savedTheme || DEFAULT_THEME); 

        const app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();

        let allPages = pages;
        let currentUser = null;
        let currentUserData = null;
        let currentIsPrivileged = false;
        let currentScrollLeft = 0; 
        let hasScrolledToActiveTab = false; 
        let globalClickListenerAdded = false;
        let authCheckCompleted = false; // <--- NEW FLAG
        let isRedirecting = false;    // <--- NEW FLAG

        const PINNED_PAGE_KEY = 'navbar_pinnedPage';
        const PIN_BUTTON_HIDDEN_KEY = 'navbar_pinButtonHidden';
        const PIN_HINT_SHOWN_KEY = 'navbar_pinHintShown';

        const getCurrentPageKey = () => {
            const currentPathname = window.location.pathname.toLowerCase();
            let bestMatchKey = null;
            let longestMatchLength = 0; // Track the length of the matched canonical URL

            const cleanPath = (path) => {
                try {
                    // If it's a relative path, resolve it against origin
                    const resolved = new URL(path, window.location.origin).pathname.toLowerCase();
                    // Normalize index.html
                    if (resolved.endsWith('/index.html')) return resolved.substring(0, resolved.lastIndexOf('/')) + '/';
                    if (resolved.length > 1 && resolved.endsWith('/')) return resolved.slice(0, -1);
                    return resolved;
                } catch (e) {
                    return path; // Fallback for invalid URLs
                }
            };

            const currentCanonical = cleanPath(currentPathname);
            
            // Collect all matching keys along with their canonical URLs
            const potentialMatches = [];

            for (const [key, page] of Object.entries(allPages)) {
                const tabCanonical = cleanPath(page.url);
                let isMatch = false;

                // 1. Check primary URL
                if (currentCanonical === tabCanonical) {
                    isMatch = true;
                }

                // 2. Check suffix matching (existing logic)
                // This is less reliable for full path differentiation, but kept for compatibility
                const tabPathSuffix = new URL(page.url, window.location.origin).pathname.toLowerCase();
                const tabSuffixClean = tabPathSuffix.startsWith('/') ? tabPathSuffix.substring(1) : tabPathSuffix;
                // Avoid aggressive suffix matching for root/short paths
                if (!isMatch && tabSuffixClean.length > 3 && currentPathname.endsWith(tabSuffixClean)) {
                    isMatch = true;
                }

                // 3. Check Aliases (NEW)
                if (!isMatch && page.aliases && Array.isArray(page.aliases)) {
                    for (const alias of page.aliases) {
                        const aliasCanonical = cleanPath(alias);
                        if (currentCanonical === aliasCanonical) {
                            isMatch = true;
                            break;
                        }
                        // Also check alias suffixes if needed, though exact path matching is safer
                        const aliasPathSuffix = new URL(alias, window.location.origin).pathname.toLowerCase();
                         const aliasSuffixClean = aliasPathSuffix.startsWith('/') ? aliasPathSuffix.substring(1) : aliasPathSuffix;
                        if (aliasSuffixClean.length > 3 && currentPathname.endsWith(aliasSuffixClean)) {
                            isMatch = true;
                            break;
                        }
                    }
                }

                if (isMatch) {
                    potentialMatches.push({ key, canonicalUrl: tabCanonical });
                }
            }

            // From potential matches, find the one with the longest canonical URL (most specific)
            if (potentialMatches.length > 0) {
                potentialMatches.sort((a, b) => b.canonicalUrl.length - a.canonicalUrl.length);
                return potentialMatches[0].key;
            }

            return null; // No match found
        };

        
        const getPinButtonHtml = () => {
            const pinnedPageKey = localStorage.getItem(PINNED_PAGE_KEY);
            const isPinButtonHidden = localStorage.getItem(PIN_BUTTON_HIDDEN_KEY) === 'true';
            const currentPageKey = getCurrentPageKey();
            const pages = allPages;
            const pinnedPageData = (pinnedPageKey && pages[pinnedPageKey]) ? pages[pinnedPageKey] : null;

            if (isPinButtonHidden) return '';
            
            const pinButtonIcon = pinnedPageData ? getIconClass(pinnedPageData.icon) : 'fa-solid fa-map-pin';
            const pinButtonUrl = pinnedPageData ? pinnedPageData.url : '#'; 
            const pinButtonTitle = pinnedPageData ? `Go to ${pinnedPageData.name}` : 'Pin current page';

            const shouldShowRepin = (pinnedPageKey && pinnedPageKey !== currentPageKey) || (!pinnedPageKey && currentPageKey);
            
            const repinOption = shouldShowRepin
                ? `<button id="repin-button" class="auth-menu-link"><i class="fa-solid fa-thumbtack w-4"></i>Repin</button>` 
                : ''; 
            
            const removeOrHideOption = pinnedPageData 
                ? `<button id="remove-pin-button" class="auth-menu-link text-red-400 hover:text-red-300"><i class="fa-solid fa-xmark w-4"></i>Remove Pin</button>`
                : `<button id="hide-pin-button" class="auth-menu-link text-red-400 hover:text-red-300"><i class="fa-solid fa-eye-slash w-4"></i>Hide Button</button>`;

            return `
                <div id="pin-area-wrapper" class="relative flex-shrink-0 flex items-center">
                    <a href="${pinButtonUrl}" id="pin-button" class="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-700 transition" title="${pinButtonTitle}">
                        <i id="pin-button-icon" class="${pinButtonIcon}"></i>
                    </a>
                    <div id="pin-context-menu" class="auth-menu-container closed" style="width: 12rem;">
                        ${repinOption}
                        ${removeOrHideOption}
                    </div>
                    <div id="pin-hint" class="pin-hint-container">
                        Right-click for options!
                    </div>
                </div>
            `;
        }

        const updatePinButtonArea = () => {
            const pinWrapper = document.getElementById('pin-area-wrapper');
            const newPinHtml = getPinButtonHtml();
            if (pinWrapper) {
                if (newPinHtml === '') {
                    pinWrapper.remove();
                } else {
                    pinWrapper.outerHTML = newPinHtml;
                }
                setupPinEventListeners();
            } else {
                const authButtonContainer = document.getElementById('auth-controls-wrapper');
                if (authButtonContainer) {
                    authButtonContainer.insertAdjacentHTML('afterbegin', newPinHtml);
                    setupPinEventListeners();
                }
            }
            document.getElementById('auth-menu-container')?.classList.add('closed');
            document.getElementById('auth-menu-container')?.classList.remove('open');
        };

        const hexToRgb = (hex) => {
            if (!hex || typeof hex !== 'string') return null;
            let c = hex.substring(1); 
            if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
            if (c.length !== 6) return null;
            const num = parseInt(c, 16);
            return { r: (num >> 16) & 0xFF, g: (num >> 8) & 0xFF, b: (num >> 0) & 0xFF };
        };

        const getLuminance = (rgb) => {
            if (!rgb) return 0;
            const a = [rgb.r, rgb.g, rgb.b].map(v => {
                v /= 255;
                return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
            });
            return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
        };

        const getLetterAvatarTextColor = (gradientBg) => {
            if (!gradientBg) return '#FFFFFF'; 
            const match = gradientBg.match(/#([0-9a-fA-F]{3}){1,2}/);
            const firstHexColor = match ? match[0] : null;
            if (!firstHexColor) return '#FFFFFF'; 
            const rgb = hexToRgb(firstHexColor);
            if (!rgb) return '#FFFFFF';
            const luminance = getLuminance(rgb);
            if (luminance > 0.5) { 
                const darkenFactor = 0.5; 
                const darkerR = Math.floor(rgb.r * darkenFactor);
                const darkerG = Math.floor(rgb.g * darkenFactor);
                const darkerB = Math.floor(rgb.b * darkenFactor);
                return `#${((1 << 24) + (darkerR << 16) + (darkerG << 8) + darkerB).toString(16).slice(1)}`;
            } else {
                return '#FFFFFF';
            }
        };

        const getAuthControlsHtml = () => {
            const user = currentUser;
            const userData = currentUserData;
            const pinButtonHtml = getPinButtonHtml();

            const loggedOutView = `
                <div id="auth-button-container" class="relative flex-shrink-0 flex items-center">
                    <button id="auth-toggle" class="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-700 transition logged-out-auth-toggle">
                        <i class="fa-solid fa-user"></i>
                    </button>
                    <div id="auth-menu-container" class="auth-menu-container closed" style="width: 12rem;">
                        <a href="/authentication.html" class="auth-menu-link">
                            <i class="fa-solid fa-lock w-4"></i>
                            Authenticate
                        </a>
                        <button id="more-button" class="auth-menu-button">
                            <i id="more-button-icon" class="fa-solid fa-chevron-down w-4"></i>
                            <span id="more-button-text">Show More</span>
                        </button>
                        <div id="more-section" class="auth-menu-more-section">
                            <a href="/documentation.html" class="auth-menu-link">
                                <i class="fa-solid fa-book w-4"></i>
                                Documentation
                            </a>
                            <a href="../legal.html" class="auth-menu-link">
                                <i class="fa-solid fa-gavel w-4"></i>
                                Terms & Policies
                            </a>
                            <a href="https://buymeacoffee.com/4simpleproblems" class="auth-menu-link" target="_blank">
                                <i class="fa-solid fa-mug-hot w-4"></i>
                                Donate
                            </a>
                        </div>
                    </div>
                </div>
            `;

            const loggedInView = (user, userData) => {
                const username = userData?.username || user.displayName || 'User';
                const email = user.email || 'No email';
                const initial = (userData?.letterAvatarText || username.charAt(0)).toUpperCase();
                let avatarHtml = '';
                const pfpType = userData?.pfpType || 'google'; 

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
                    const bg = userData?.pfpLetterBg || DEFAULT_THEME['avatar-gradient'];
                    const textColor = getLetterAvatarTextColor(bg); 
                    const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base'); 
                    avatarHtml = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                } else {
                    const googleProvider = user.providerData.find(p => p.providerId === 'google.com');
                    const googlePhoto = googleProvider ? googleProvider.photoURL : null;
                    const displayPhoto = googlePhoto || user.photoURL;

                    if (displayPhoto) {
                        avatarHtml = `<img src="${displayPhoto}" class="w-full h-full object-cover rounded-full" alt="Profile">`;
                    } else {
                        const bg = DEFAULT_THEME['avatar-gradient'];
                        const textColor = getLetterAvatarTextColor(bg);
                        const fontSizeClass = initial.length >= 3 ? 'text-xs' : (initial.length === 2 ? 'text-sm' : 'text-base');
                        avatarHtml = `<div class="initial-avatar w-full h-full rounded-full font-semibold ${fontSizeClass}" style="background: ${bg}; color: ${textColor}">${initial}</div>`;
                    }
                }
                
                const isPinHidden = localStorage.getItem(PIN_BUTTON_HIDDEN_KEY) === 'true';
                const showPinOption = isPinHidden 
                    ? `<button id="show-pin-button" class="auth-menu-link"><i class="fa-solid fa-map-pin w-4"></i>Show Pin Button</button>` 
                    : '';
                
                return `
                    <div id="auth-button-container" class="relative flex-shrink-0 flex items-center">
                        <button id="auth-toggle" class="w-10 h-10 rounded-full border border-gray-600 overflow-hidden">
                            ${avatarHtml}
                        </button>
                        <div id="auth-menu-container" class="auth-menu-container closed">
                            <div class="border-b border-gray-700 mb-2 w-full min-w-0 flex items-center">
                                <div class="min-w-0 flex-1 overflow-hidden">
                                    <div class="marquee-container" id="username-marquee">
                                        <p class="text-sm font-semibold auth-menu-username marquee-content">${username}</p>
                                    </div>
                                    <div class="marquee-container" id="email-marquee">
                                        <p class="text-xs text-gray-400 auth-menu-email marquee-content">${email}</p>
                                    </div>
                                </div>
                            </div>
                            <a href="/logged-in/settings.html" class="auth-menu-link">
                                <i class="fa-solid fa-gear w-4"></i>
                                Settings
                            </a>
                            ${showPinOption}
                            <button id="logout-button" class="auth-menu-button text-red-400 hover:bg-red-900/50 hover:text-red-300">
                                <i class="fa-solid fa-right-from-bracket w-4"></i>
                                Log Out
                            </button>
                             <button id="more-button" class="auth-menu-button">
                                <i id="more-button-icon" class="fa-solid fa-chevron-down w-4"></i>
                                <span id="more-button-text">Show More</span>
                            </button>
                            <div id="more-section" class="auth-menu-more-section">
                                <a href="/documentation.html" class="auth-menu-link">
                                    <i class="fa-solid fa-book w-4"></i>
                                    Documentation
                                </a>
                                <a href="../legal.html" class="auth-menu-link">
                                    <i class="fa-solid fa-gavel w-4"></i>
                                    Terms & Policies
                                </a>
                                <a href="https://buymeacoffee.com/4simpleproblems" class="auth-menu-link" target="_blank">
                                    <i class="fa-solid fa-mug-hot w-4"></i>
                                    Donate
                                </a>
                            </div>
                        </div>
                    </div>
                `;
            };

            return `
                ${pinButtonHtml}
                ${user ? loggedInView(user, userData) : loggedOutView}
            `;
        }

        const setupAuthToggleListeners = (user) => {
            const toggleButton = document.getElementById('auth-toggle');
            const menu = document.getElementById('auth-menu-container');

            if (toggleButton && menu) {
                toggleButton.addEventListener('click', (e) => {
                    e.stopPropagation();
                    menu.classList.toggle('closed');
                    menu.classList.toggle('open');
                    document.getElementById('pin-context-menu')?.classList.add('closed');
                    document.getElementById('pin-context-menu')?.classList.remove('open');
                    if (menu.classList.contains('open')) checkMarquees();
                });
            }

            const moreButton = document.getElementById('more-button');
            const moreSection = document.getElementById('more-section');
            const moreButtonIcon = document.getElementById('more-button-icon');
            const moreButtonText = document.getElementById('more-button-text');

            if (moreButton && moreSection) {
                moreButton.addEventListener('click', () => {
                    const isExpanded = moreSection.style.display === 'block';
                    moreSection.style.display = isExpanded ? 'none' : 'block';
                    moreButtonText.textContent = isExpanded ? 'Show More' : 'Show Less';
                    moreButtonIcon.classList.toggle('fa-chevron-down', isExpanded);
                    moreButtonIcon.classList.toggle('fa-chevron-up', !isExpanded);
                });
            }

            const showPinButton = document.getElementById('show-pin-button');
            if (showPinButton) {
                showPinButton.addEventListener('click', () => {
                    localStorage.setItem(PIN_BUTTON_HIDDEN_KEY, 'false'); 
                    updateAuthControlsArea();
                });
            }

            if (user) {
                const logoutButton = document.getElementById('logout-button');
                if (logoutButton) {
                    logoutButton.addEventListener('click', () => {
                        auth.signOut().catch(err => console.error("Logout failed:", err));
                    });
                }
            }
        };

        const updateAuthControlsArea = () => {
            const authWrapper = document.getElementById('auth-controls-wrapper');
            if (!authWrapper) return;
            authWrapper.innerHTML = getAuthControlsHtml();
            setupPinEventListeners();
            setupAuthToggleListeners(currentUser); 
        }

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

        const rerenderNavbar = (preserveScroll = false) => {
             if (preserveScroll) {
                const tabContainer = document.querySelector('.tab-scroll-container');
                if (tabContainer) {
                    currentScrollLeft = tabContainer.scrollLeft;
                } else {
                    currentScrollLeft = 0;
                }
            }
            renderNavbar(currentUser, currentUserData, allPages, currentIsPrivileged);
        };

        const renderNavbar = (user, userData, pages, isPrivilegedUser) => {
            const container = document.getElementById('navbar-container');
            if (!container) return; 

            const navElement = container.querySelector('nav');
            const tabWrapper = navElement.querySelector('.tab-wrapper');
            const authControlsWrapper = document.getElementById('auth-controls-wrapper');
            const navbarLogo = document.getElementById('navbar-logo');

            const logoPath = DEFAULT_THEME['logo-src']; 
            if (navbarLogo) navbarLogo.src = logoPath;
            
            // Determine the single active page key first
            const activePageKey = getCurrentPageKey();

            const tabsHtml = Object.entries(pages || {})
                .filter(([, page]) => !(page.adminOnly && !isPrivilegedUser)) 
                .map(([key, page]) => { // Get key and page from entry
                    const isActive = (key === activePageKey); // Compare with the single activePageKey
                    const activeClass = isActive ? 'active' : '';
                    const iconClasses = getIconClass(page.icon);
                    return `<a href="${page.url}" class="nav-tab ${activeClass}"><i class="${iconClasses} mr-2"></i>${page.name}</a>`;
                }).join('');

            const authControlsHtml = getAuthControlsHtml();

            let tabContainerElement = null; // Declare here to make it accessible

            if (tabWrapper) {
                tabWrapper.innerHTML = `
                    <button id="glide-left" class="scroll-glide-button"><i class="fa-solid fa-chevron-left"></i></button>
                    <div class="tab-scroll-container">
                        ${tabsHtml}
                    </div>
                    <button id="glide-right" class="scroll-glide-button"><i class="fa-solid fa-chevron-right"></i></button>
                `;
                tabContainerElement = tabWrapper.querySelector('.tab-scroll-container'); // Assign to the declared variable
            }

            if (authControlsWrapper) {
                authControlsWrapper.innerHTML = authControlsHtml;
            }
            
            // Use tabContainerElement for logic and styling
            const tabCount = tabContainerElement ? tabContainerElement.querySelectorAll('.nav-tab').length : 0;

            if (tabCount <= 9) {
                if(tabContainerElement) {
                    tabContainerElement.style.justifyContent = 'center';
                    tabContainerElement.style.overflowX = 'hidden';
                    tabContainerElement.style.flexGrow = '0';
                }
            } else {
                if(tabContainerElement) {
                    tabContainerElement.style.justifyContent = 'flex-start';
                    tabContainerElement.style.overflowX = 'auto';
                    tabContainerElement.style.flexGrow = '1';
                }
            }

            // Call setupEventListeners with the correct tabContainerElement
            setupEventListeners(user, tabContainerElement); 

            let savedTheme;
            try {
                savedTheme = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY));
            } catch (e) { savedTheme = null; }
            window.applyTheme(savedTheme || DEFAULT_THEME); 

            if (currentScrollLeft > 0) {
                const savedScroll = currentScrollLeft;
                requestAnimationFrame(() => {
                    if (tabContainerElement) tabContainerElement.scrollLeft = savedScroll; // Use tabContainerElement
                    currentScrollLeft = 0; 
                    requestAnimationFrame(() => {
                        updateScrollGilders();
                    });
                });
            } else if (!hasScrolledToActiveTab) { 
                const activeTab = document.querySelector('.nav-tab.active'); // This query might need to be relative to tabContainerElement
                if (activeTab && tabContainerElement) { // Use tabContainerElement
                    const centerOffset = (tabContainerElement.offsetWidth - activeTab.offsetWidth) / 2; // Use tabContainerElement
                    const idealCenterScroll = activeTab.offsetLeft - centerOffset;
                    const maxScroll = tabContainerElement.scrollWidth - tabContainerElement.offsetWidth; // Use tabContainerElement
                    const extraRoomOnRight = maxScroll - idealCenterScroll;
                    let scrollTarget;

                    if (idealCenterScroll > 0 && extraRoomOnRight < centerOffset) {
                        scrollTarget = maxScroll + 50;
                    } else {
                        scrollTarget = Math.max(0, idealCenterScroll);
                    }
                    requestAnimationFrame(() => {
                        tabContainerElement.scrollLeft = scrollTarget; // Use tabContainerElement
                        requestAnimationFrame(() => {
                            updateScrollGilders();
                        });
                    });
                    hasScrolledToActiveTab = true; 
                } else if (tabContainerElement) { // Use tabContainerElement
                    requestAnimationFrame(() => {
                        updateScrollGilders();
                    });
                }
            }
            
            checkMarquees();
        };
