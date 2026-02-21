import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role to fetch all items reliably
);

export async function POST(req: Request) {
    try {
        const { prompt, userId, date } = await req.json();
        console.log('AI Diet Gen Request received:', { prompt, userId, date });

        if (!prompt) {
            console.error('Missing prompt in request');
            return NextResponse.json({ error: 'Falta el comando de dieta' }, { status: 400 });
        }

        // 1. Fetch available food items for context - With fallback for offline DB
        console.log('Fetching food items from Supabase...');
        let foodContext = "No hay alimentos locales disponibles actualmente (usar conocimiento interno).";
        try {
            const { data: foodItems, error: dbError } = await supabase
                .from('food_items')
                .select('id, nombre, kcal, proteinas, carbohidratos, grasas, estado');

            if (dbError) throw dbError;

            if (foodItems && foodItems.length > 0) {
                console.log('Food items fetched successfully:', foodItems.length);
                foodContext = foodItems.map(f => (
                    `- ${f.nombre} (${f.estado}): ${f.kcal} kcal, P:${f.proteinas}g, C:${f.carbohidratos}g, G:${f.grasas}g (ID: ${f.id})`
                )).join('\n');
            }
        } catch (dbError) {
            console.warn('Supabase offline or unreachable. Proceeding without local context.', dbError);
        }

        // 2. Prepare Gemini Prompt - Using Gemini 3 Flash Preview as identified in available models
        console.log('Initializing Gemini model: models/gemini-3-flash-preview');
        const model = genAI.getGenerativeModel({
            model: "models/gemini-3-flash-preview"
        });

        const systemPrompt = `
        Eres un experto nutricionista deportivo. Tu tarea es generar un plan de comidas diario basado en el pedido del usuario.
        
        REGLAS ESTRICTAS:
        1. Debes calcular las cantidades exactas en GRAMOS (siempre en estado COCIDO) para que el total del día coincida con las calorías y macros solicitados.
        2. Intenta usar los alimentos de la base de datos local proporcionada si encajan. Si usas uno local, incluye su ID exacto.
        3. Si el usuario pide algo que NO está en la lista local, búscalo en tu conocimiento y genera la info nutricional por cada 100g (siempre en COCIDO).
        4. No inventes IDs si el alimento no es exactamente el de la lista local. Pon null en "food_id" si es un alimento nuevo.
        5. El resultado debe ser un JSON válido con esta estructura:
        {
          "summary": { "total_kcal": 0, "total_p": 0, "total_c": 0, "total_g": 0 },
          "meals": [
            {
              "comida_tipo": "Desayuno" | "Almuerzo" | "Cena" | "Snack 1" | "Snack 2" | "Snack 3",
              "food_id": "UUID o null",
              "nombre": "Nombre del alimento",
              "gramos_cocido": 0,
              "kcal": 0,
              "p": 0,
              "c": 0,
              "g": 0
            }
          ]
        }

        CONTEXTO DE ALIMENTOS LOCALES (info por 100g):
        ${foodContext}

        PEDIDO DEL USUARIO:
        "${prompt}"
        `;

        console.log('Sending request to Gemini...');
        const result = await model.generateContent(systemPrompt);
        console.log('Response received from Gemini');
        let responseText = result.response.text();

        console.log('Gemini Raw Response:', responseText);

        // Robust JSON extraction
        if (responseText.includes('```json')) {
            responseText = responseText.split('```json')[1].split('```')[0].trim();
        } else if (responseText.includes('```')) {
            responseText = responseText.split('```')[1].split('```')[0].trim();
        }

        try {
            const plan = JSON.parse(responseText);
            return NextResponse.json(plan);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError, 'Text:', responseText);
            return NextResponse.json({ error: 'La IA devolvió un formato inválido', raw: responseText }, { status: 500 });
        }
    } catch (error: any) {
        console.error('Error en AI Diet Gen:', error);
        return NextResponse.json({
            error: 'Error al generar la dieta con IA',
            details: error?.message || 'Error desconocido'
        }, { status: 500 });
    }
}
