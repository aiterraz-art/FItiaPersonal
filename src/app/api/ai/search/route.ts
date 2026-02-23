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
REGLAS CRÍTICAS DE PRECISIÓN NUTRICIONAL:
1. FUENTES REALES: Usa Google para encontrar información de etiquetas nutricionales reales (Chile: Lider, Jumbo, Marcas como Lucchetti, Carozzi, Ideal, Colun).
2. BASE 100G: Los campos "kcal", "proteinas", "carbohidratos" y "grasas" DEBEN ser SIEMPRE por cada 100 gramos. Si la etiqueta solo da valores "por porción", calcula matemáticamente el equivalente a 100g.
3. ANÁLISIS DE PORCIÓN: Identifica la porción sugerida de la etiqueta.
   - "porcion_nombre": Nombre específico de la unidad (ej: "1 rebanada", "1/2 unidad", "1 envase", "1 huevo").
   - "porcion_gramos": Cuánto pesa exactamente esa porción en gramos.
4. DIFERENCIA CRUDO/COCIDO (CRITICAL): 
   - Para pastas, arroz y legumbres, la diferencia es abismal por el peso del agua. 
   - SIEMPRE indica en el "nombre" si el valor es "(Crudo)" o "(Cocido)".
   - Si el usuario busca "Pasta", devuelve opciones para ambos estados si es posible.
   - Datos referencia: Pasta cruda (~350 kcal/100g) vs Cocida (~130-150 kcal/100g). No los confundas.
5. Responde EXCLUSIVAMENTE con un JSON válido:
{"items": [
  {
    "nombre":"Nombre Marca - Producto (Crudo/Cocido)",
    "kcal":0,
    "proteinas":0,
    "carbohidratos":0,
    "grasas":0,
    "categoria":"Categoría",
    "estado":"crudo|cocido|n/a",
    "porcion_nombre": "nombre de la unidad", 
    "porcion_gramos": 0
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
