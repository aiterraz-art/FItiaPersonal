const fs = require('fs');
const path = require('path');

async function test() {
    const envFile = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
    const match = envFile.match(/GOOGLE_GENERATIVE_AI_API_KEY=(.*)/);
    const apiKey = match ? match[1].trim() : null;

    if (!apiKey) {
        console.error("No API Key found");
        return;
    }

    console.log("Using API Key:", apiKey.substring(0, 10) + "...");

    try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await res.json();
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => console.log("- " + m.name));
        } else {
            console.error("No models found. Error:", JSON.stringify(data));
        }
    } catch (e) {
        console.error("Fetch Error:", e);
    }
}

test();
