import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

export async function POST(req: Request) {
    try {
        const { image } = await req.json(); // base64 image

        if (!image) {
            return NextResponse.json({ error: 'No se Proporcionó ninguna imagen' }, { status: 400 });
        }

        // Initialize Gemini 2.0 Flash for vision
        const model = genAI.getGenerativeModel({
            model: "models/gemini-2.0-flash"
        });

        const prompt = `
        Analiza esta imagen de un plato de comida. 
        Identifica los alimentos presentes y estima su peso en gramos (estado COCIDO).
        
        REGLAS:
        1. Sé lo más preciso posible.
        2. El resultado debe ser un JSON puro con esta estructura:
        {
          "items": [
            {
              "nombre": "Nombre del alimento",
              "gramos": 0,
              "kcal": 0,
              "p": 0,
              "c": 0,
              "g": 0
            }
          ],
          "total_kcal": 0
        }
        
        Devuelve SOLO el JSON sin markdown ni explicaciones.
        `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: image.split(',')[1],
                    mimeType: "image/jpeg"
                }
            }
        ]);

        let responseText = result.response.text();

        // Clean JSON if needed
        if (responseText.includes('```json')) {
            responseText = responseText.split('```json')[1].split('```')[0].trim();
        } else if (responseText.includes('```')) {
            responseText = responseText.split('```')[1].split('```')[0].trim();
        }

        const scanResult = JSON.parse(responseText);
        return NextResponse.json(scanResult);

    } catch (error: any) {
        console.error('Vision Scan Error:', error);
        return NextResponse.json({
            error: 'Error al analizar la imagen',
            details: error.message
        }, { status: 500 });
    }
}
