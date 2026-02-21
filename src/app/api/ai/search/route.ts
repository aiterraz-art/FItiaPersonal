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
El usuario busca: "${query}".
REGLAS CRÍTICAS:
1. Usa la búsqueda de Google para encontrar versiones REALES y ESPECÍFICAS del producto (especialmente de marcas chilenas como Lider, Soprole, Colun, Jumbo, etc.).
2. Encuentra hasta 5 opciones diferentes si existen.
3. Para cada opción, obtén la información nutricional exacta por cada 100 GRAMOS.
4. MUY IMPORTANTE: Identifica si el producto tiene una PORCIÓN estándar (ej: "1 rebajada", "1 unidad", "1 envase", "1 pote"). Obtén el nombre de esa porción y cuántos GRAMOS pesa esa porción única.
5. Responde EXCLUSIVAMENTE con un JSON válido en este formato exacto:
{"items": [
  {
    "nombre":"Nombre exacto del producto 1",
    "kcal":0,
    "proteinas":0,
    "carbohidratos":0,
    "grasas":0,
    "categoria":"Categoría",
    "estado":"n/a",
    "porcion_nombre": "unidad", 
    "porcion_gramos": 30
  }
]}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    // Robustly extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const data = JSON.parse(jsonMatch[0]);

    if (!data.items || !Array.isArray(data.items)) {
      if (data.nombre) {
        return NextResponse.json({ items: [data] });
      }
      throw new Error("Invalid response format from AI");
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI nutrition info: " + error.message },
      { status: 500 }
    );
  }
}
