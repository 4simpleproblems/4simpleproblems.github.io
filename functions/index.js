const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();

// ==================================================================
// CONFIGURATION: API KEYS
// Get these from https://dictionaryapi.com/ (Merriam-Webster)
// ==================================================================
const MW_DICT_KEY = "YOUR_MERRIAM_WEBSTER_DICTIONARY_KEY"; 
const MW_THES_KEY = "YOUR_MERRIAM_WEBSTER_THESAURUS_KEY";
// ==================================================================

// V2 Function with built-in CORS support
exports.getWordData = onRequest({ cors: true }, async (req, res) => {
    try {
        const word = req.query.word;

        if (!word) {
            res.status(400).json({ error: "Missing 'word' query parameter" });
            return;
        }

        // logger.info(`Fetching data for word: ${word}`);

        // Execute both API calls in parallel
        const [dictResponse, thesResponse] = await Promise.all([
            axios.get(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${MW_DICT_KEY}`),
            axios.get(`https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${encodeURIComponent(word)}?key=${MW_THES_KEY}`)
        ]);

        res.status(200).json({
            dictionary: dictResponse.data,
            thesaurus: thesResponse.data
        });

    } catch (error) {
        logger.error("Error in getWordData:", error);
        
        const status = error.response ? error.response.status : 500;
        const message = error.message || "Internal Server Error";
        
        res.status(status).json({ 
            error: message,
            details: "Check Cloud Function logs for more info." 
        });
    }
});

exports.leviumProxy = onRequest({ cors: true }, async (req, res) => {
    const TARGET_ORIGIN = "https://levium-student-management.global.ssl.fastly.net";
    const PROXY_BASE_PATH = "/leviumProxy/"; // Define proxy base path here
    
    // Default to levium.html if root is requested
    let path = req.path;
    if (!path || path === "/") {
        path = "/levium.html";
    }

    const url = TARGET_ORIGIN + path;

    try {
        const response = await axios({
            method: req.method,
            url: url,
            params: req.query,
            responseType: 'arraybuffer', // vital for binary files and manual string decoding
            validateStatus: () => true, // capture all statuses
            headers: {
                ...req.headers,
                // Spoof headers to make the target think it's a direct request
                host: new URL(TARGET_ORIGIN).host,
                origin: TARGET_ORIGIN,
                referer: TARGET_ORIGIN + '/'
            }
        });

        // Forward headers from the target response to the client
        for (const [key, value] of Object.entries(response.headers)) {
            const lowerKey = key.toLowerCase();
            // content-length: we might modify the body, so let the framework set it
            // content-encoding: axios decodes it, so we don't want to say it's gzip if we send plain text
            // host: never forward host
            if (!['host', 'content-length', 'content-encoding'].includes(lowerKey)) {
                res.setHeader(key, value);
            }
        }

        const contentType = response.headers['content-type'] || '';

        // If it's HTML, we need to rewrite paths so the browser keeps using the proxy
        if (contentType.includes('text/html')) {
            let html = response.data.toString('utf8');

            // 1. Rewrite HTML attributes that start with '/' (absolute paths)
            // src="/foo.js" -> src="/leviumProxy/foo.js"
            // Negative lookahead (?!\/) ensures we don't match protocol relative URLs (//example.com)
            html = html.replace(/(src|href|action|data-url)=["']\/(?!\/)(.*?)["']/g, (match, attr, path) => {
                const quote = match.includes("'") ? "'" : '"';
                return `${attr}=${quote}${PROXY_BASE_PATH}${path}${quote}`;
            });
            
            // 2. Rewrite specific UV/Bare patterns often found in JS strings
            // Catch "/uv/" literal strings in JS
            html = html.replace(/"\/uv\//g, `"${PROXY_BASE_PATH}uv/`);
            html = html.replace(/'\/uv\//g, `'${PROXY_BASE_PATH}uv/`);
            
            // 3. Rewrite usage of /bare/ if it exists
            html = html.replace(/"\/bare\//g, `"${PROXY_BASE_PATH}bare/`);
            html = html.replace(/'\/bare\//g, `'${PROXY_BASE_PATH}bare/`);

            // 4. Rewrite <base href="/..."> tags to point to the proxy base path
            // This is crucial if the original page sets a different base for relative URLs
            html = html.replace(/<base\s+href=["']\/(?!\/)(.*?)["']\s*\/?>/i, `<base href="${PROXY_BASE_PATH}$1">`);


            res.status(response.status).send(html); // Ensure status is forwarded
        } else {
            // For non-HTML (JS, CSS, Images, etc.), just send the buffer
            res.status(response.status).send(response.data);
        }
    } catch (error) {
        logger.error("Proxy Error", error);
        res.status(500).send("Proxy Error: " + error.message); // More descriptive error
    }
});