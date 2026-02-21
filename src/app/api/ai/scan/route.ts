import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("image") as File;

        if (!file) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const base64 = Buffer.from(bytes).toString("base64");
        const mimeType = file.type || "image/jpeg";

        const prompt = `Analiza esta imagen de una etiqueta nutricional o alimento.
Extrae la información nutricional POR CADA 100 GRAMOS.
Si la etiqueta muestra valores por porción, calcula los valores por 100g.
Si no es una etiqueta nutricional sino una foto de comida, estima los valores nutricionales.

Responde EXCLUSIVAMENTE con un JSON válido, sin bloques de código, sin texto adicional:
{"nombre":"Nombre del producto","kcal":0,"proteinas":0,"carbohidratos":0,"grasas":0,"categoria":"Categoría","porcion_g":0}

Donde porcion_g es el tamaño de porción que aparece en la etiqueta (en gramos). Si no hay porción visible, pon 100.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType,
                    data: base64,
                },
            },
        ]);

        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        const data = JSON.parse(jsonMatch[0]);

        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Vision Error:", error);
        return NextResponse.json(
            { error: "Error al analizar la imagen: " + error.message },
            { status: 500 }
        );
    }
}
