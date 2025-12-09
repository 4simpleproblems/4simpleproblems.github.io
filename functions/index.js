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
            responseType: 'stream', // Reverted to stream for transparency
            decompress: false, // Forward raw compressed data if applicable
            validateStatus: () => true,
            headers: {
                // Forward client headers but override Host, Origin, and Referer to match target
                ...req.headers,
                host: new URL(TARGET_ORIGIN).host,
                origin: TARGET_ORIGIN,
                referer: TARGET_ORIGIN + '/'
            }
        });

        // Forward headers
        for (const [key, value] of Object.entries(response.headers)) {
            // Avoid setting headers that might confuse the server/client loop
            if (key.toLowerCase() !== 'host' && key.toLowerCase() !== 'content-length') {
                res.setHeader(key, value);
            }
        }

        res.status(response.status);
        response.data.pipe(res);
    } catch (error) {
        logger.error("Proxy Error", error);
        res.status(500).send("Proxy Error");
    }
});