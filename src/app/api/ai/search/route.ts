import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({
  model: "gemini-3-flash-preview",
  tools: [{ googleSearch: {} }] as any
});

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const prompt = `Actúa como un experto en nutrición y buscador de productos de supermercado. 
El usuario busca un alimento específico: "${query}".
REGLAS CRÍTICAS:
1. Usa la búsqueda de Google para encontrar la información nutricional REAL del producto (especialmente si es de marcas chilenas como Lider, Soprole, Colun, etc.).
2. Si es un producto de supermercado (ej: "pan precocido Lider"), busca los datos exactos por cada 100g.
3. Proporciona la información nutricional POR CADA 100 GRAMOS.
4. Responde EXCLUSIVAMENTE con un JSON válido, sin bloques de código, sin texto adicional:
{"nombre":"Nombre exacto del producto","kcal":0,"proteinas":0,"carbohidratos":0,"grasas":0,"categoria":"Categoría","estado":"n/a"}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Robustly extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const data = JSON.parse(jsonMatch[0]);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI nutrition info: " + error.message },
      { status: 500 }
    );
  }
}
