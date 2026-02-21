import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "Query is required" }, { status: 400 });
    }

    const prompt = `Actúa como un experto en nutrición. El usuario busca: "${query}".
Proporciona la información nutricional aproximada POR CADA 100 GRAMOS.
Responde EXCLUSIVAMENTE con un JSON válido, sin bloques de código, sin texto adicional:
{"nombre":"Nombre descriptivo","kcal":0,"proteinas":0,"carbohidratos":0,"grasas":0,"categoria":"Categoría","estado":"n/a"}`;

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
