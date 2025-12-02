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