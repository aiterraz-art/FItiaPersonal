require('dotenv').config({ path: '.env.local' });
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    console.log("Testing Gemini API Key...");
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
        console.error("No API Key found in .env.local");
        return;
    }
    console.log("API Key found (length):", apiKey.length);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = "Generate a single meal JSON plan: { 'name': 'test' }";
        console.log("Generating content...");
        const result = await model.generateContent(prompt);
        console.log("Response Status:", result.response.candidates?.[0]?.finishReason);
        console.log("Response Text:", result.response.text());
    } catch (e) {
        console.error("Gemini API Error:", e);
    }
}

test();
