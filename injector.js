/**
 * Script Loader (Centralized Dependency Manager)
 * * This file dynamically creates and appends <script> tags for 
 * all listed files, ensuring only this file needs to be updated 
 * when adding or removing application dependencies.
 */
(function() {
    // 1. DEFINE YOUR SCRIPTS HERE
    // Update this array (and ONLY this array) to manage your application's scripts.
    const scriptsToLoad = [
      '../url-changer.js',
      '../panic-key.js',
      '../navigation.js',
      '../ban-enforcer.js',
      '../admin_keybinds.js'
    ];

    // 2. CORE DYNAMIC LOADING FUNCTION
    /**
     * Creates a Promise to load a script element, resolving when loaded.
     */
    function loadScript(url) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true; // Prevents blocking the rest of the page render

            // Set up event listeners
            script.onload = () => {
                console.log(`Script loaded: ${url}`);
                resolve(url);
            };
            script.onerror = () => {
                console.error(`Failed to load script: ${url}`);
                reject(new Error(`Loading error for ${url}`));
            };

            // Inject the script into the document's head to start the download
            document.head.appendChild(script);
        });
    }

    // 3. INITIATE LOADING PROCESS
    // Load all scripts in parallel and wait for all to complete
    const loadingPromises = scriptsToLoad.map(loadScript);

    Promise.all(loadingPromises)
        .then(() => {
            console.log('--- All application scripts loaded successfully! ---');
            // OPTIONAL: Place initialization code here that requires ALL scripts to be ready.
            // Example: if (window.initApp) { window.initApp(); }
        })
        .catch(error => {
            console.error('Loader encountered errors during script loading:', error);
        });

})();
