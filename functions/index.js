const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cors = require("cors")({ origin: true });

admin.initializeApp();

// ==================================================================
// CONFIGURATION: API KEYS
// Get these from https://dictionaryapi.com/ (Merriam-Webster)
// ==================================================================
const MW_DICT_KEY = "YOUR_MERRIAM_WEBSTER_DICTIONARY_KEY"; 
const MW_THES_KEY = "YOUR_MERRIAM_WEBSTER_THESAURUS_KEY";
// ==================================================================

exports.getWordData = functions.https.onRequest((req, res) => {
    // Use CORS middleware to allow cross-origin requests
    cors(req, res, async () => {
        try {
            const word = req.query.word;

            if (!word) {
                return res.status(400).json({ error: "Missing 'word' query parameter" });
            }

            // console.log(`Fetching data for word: ${word}`);

            // Execute both API calls in parallel for better performance
            const [dictResponse, thesResponse] = await Promise.all([
                axios.get(`https://www.dictionaryapi.com/api/v3/references/collegiate/json/${encodeURIComponent(word)}?key=${MW_DICT_KEY}`),
                axios.get(`https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${encodeURIComponent(word)}?key=${MW_THES_KEY}`)
            ]);

            // Return the combined data
            res.status(200).json({
                dictionary: dictResponse.data,
                thesaurus: thesResponse.data
            });

        } catch (error) {
            console.error("Error in getWordData:", error);
            
            // Attempt to return a useful error message
            const status = error.response ? error.response.status : 500;
            const message = error.message || "Internal Server Error";
            
            res.status(status).json({ 
                error: message,
                details: "Check Cloud Function logs for more info." 
            });
        }
    });
});
