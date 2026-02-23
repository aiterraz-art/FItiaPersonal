import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

export async function POST(req: Request) {
    try {
        const { food, action, targetState } = await req.json();

        if (!food || !action) {
            return NextResponse.json({ error: "Food and action are required" }, { status: 400 });
        }

        let prompt = "";

        if (action === "convert-state") {
            prompt = `Actúa como un experto en nutrición y química culinaria.
Tengo este alimento: "${food.nombre}" con la siguiente información nutricional por cada 100g en estado ${food.estado || 'desconocido'}:
- Calorías: ${food.kcal} kcal
- Proteínas: ${food.proteinas}g
- Carbohidratos: ${food.carbohidratos}g
- Grasas: ${food.grasas}g

Calcula los valores nutricionales por cada 100g si el alimento cambia al estado "${targetState}".
REGLAS:
1. Considera factores de hidratación/deshidratación reales (ej: la pasta y el arroz triplican su peso al cocerse, dividiendo sus macros por ~3).
2. Si el alimento es algo que no cambia de estado (ej: una manzana), devuelve los mismos valores pero con el nuevo estado.
3. Responde EXCLUSIVAMENTE con un JSON válido:
{
  "kcal": 0,
  "proteinas": 0,
  "carbohidratos": 0,
  "grasas": 0,
  "estado": "${targetState}",
  "nombre": "${food.nombre} (${targetState.charAt(0).toUpperCase() + targetState.slice(1)})"
}`;
        } else if (action === "discover-unit") {
            prompt = `Actúa como un experto en nutrición. 
Tengo el alimento: "${food.nombre}". 
Determina cuál es la unidad de medida más común para este alimento (ej: "unidad", "rebanada", "taza", "envase", "pote", "huevo", "tomate", "rebanada de pan", "tajada de jamón").
Estimación CRÍTICA: Proporciona el peso estándar en GRAMOS para esa unidad.

Ejemplos referencia:
- Jamón/Queso: "rebanada" (~20g)
- Huevo: "unidad" (~50g)
- Fruta (Manzana): "unidad" (~150-180g)
- Pan de molde: "rebanada" (~25-30g)
- Yogurt: "pote" (~125g)

Responde EXCLUSIVAMENTE con un JSON válido:
{
  "porcion_nombre": "nombre de la unidad",
  "porcion_gramos": 0
}`;
        } else {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");

        const data = JSON.parse(jsonMatch[0]);
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Refinement Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
