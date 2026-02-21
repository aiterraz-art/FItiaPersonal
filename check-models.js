require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function listModels() {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey);
    try {
        // There is no direct listModels in the main export for 0.24.1 in standard way?
        // Actually, let's try to fetch it manually or use the client if available.
        // For now, I'll just try 'gemini-1.5-flash-latest' and 'gemini-1.5-pro' in the test script.
        const models = ['gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro', 'gemini-1.5-flash'];
        for (const m of models) {
            try {
                const model = genAI.getGenerativeModel({ model: m });
                await model.generateContent("hello");
                console.log(`Model ${m} is AVAILABLE`);
            } catch (e) {
                console.log(`Model ${m} FAILED: ${e.message}`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
}

listModels();
