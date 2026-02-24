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
        Analiza esta imagen atentamente. Puede ser una ETIQUETA NUTRICIONAL o un PLATO DE COMIDA.

        SI ES UNA ETIQUETA NUTRICIONAL (o paquete de comida):
        1. Extrae o deduce el nombre del producto para "nombre".
        2. Extrae las kcal, proteínas (p), carbohidratos (c) y grasas (g).
        3. OBLIGATORIO: Convierte y normaliza los macros (kcal, p, c, g) para que sean los valores correspondientes a 100 gramos exactos, haciendo la regla de 3 si la etiqueta solo da valores por porción.
        4. Si la etiqueta indica un "tamaño de porción" (serving size), pon el nombre de la porción en "porcion_nombre" (ej: "galleta", "rebanada", "pieza", "porción") y los gramos equivalentes a esa porción en "porcion_gramos". Si no se menciona porción, pon los que correspondan al paquete.
        
        SI ES UN PLATO DE COMIDA:
        1. Identifica el alimento o plato para "nombre".
        2. OBLIGATORIO: Si el alimento es una unidad discreta (ej: "huevo", "manzana", "galleta", "yogurt", "rebanada de pan"), asume UNA unidad y devuélvelo en "porcion_nombre" y su peso estimado en "porcion_gramos".
        3. Normaliza las kcal, p, c, g a 100 gramos exactos.

        El resultado OBLIGATORIO debe ser un JSON puro con esta estructura:
        {
          "items": [
            {
              "nombre": "Nombre del producto/plato",
              "kcal": 0,
              "p": 0,
              "c": 0,
              "g": 0,
              "porcion_nombre": "unidad/rebanada/etc",
              "porcion_gramos": 0,
              "gramos": 100
            }
          ]
        }
        
        Asegúrate de que kcal, p, c, g sean numéricos y estén calculados en base a 100g (OBLIGATORIO). Si la etiqueta da valores por porción, haz la regla de 3 a 100g.
        Devuelve SOLO el JSON puro sin markdown ni explicaciones adicionales.
        `;

        // Extract real mimeType from data URI (e.g. "data:image/png;base64,...")
        const mimeMatch = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+);base64,/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        const base64Data = image.includes(',') ? image.split(',')[1] : image;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType
                }
            }
        ]);

        let responseText = result.response.text();

        // Clean JSON if wrapped in markdown code blocks
        if (responseText.includes('```json')) {
            responseText = responseText.split('```json')[1].split('```')[0].trim();
        } else if (responseText.includes('```')) {
            responseText = responseText.split('```')[1].split('```')[0].trim();
        }

        // Regex fallback: extract first JSON object/array from response
        if (!responseText.trim().startsWith('{') && !responseText.trim().startsWith('[')) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) responseText = jsonMatch[0];
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
