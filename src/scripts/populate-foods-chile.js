const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-2.0-flash" });

const categories = [
    { name: "Vegetales y Hortalizas", focus: "Todo tipo de vegetales frescos, congelados y en conserva comunes en Chile. Marcas: Minuto Verde, Lider, Jumbo." },
    { name: "Frutas y Bayas", focus: "Frutas chilenas, frutos secos de marcas como Piwen, El Galeón." },
    { name: "Lácteos y Postres", focus: "Soprole, Colun, Nestlé, Danone, Quillayes. Yogures (Next, Uno, Protein), Leches, Quesos." },
    { name: "Abarrotes y Pastas", focus: "Carozzi, Lucchetti, Arroz Tucapel, Banquete, Legumbres Wasil, Salsas Malloa." },
    { name: "Panadería y Galletas", focus: "Ideal, Castaño, Fuchs, Galletas Costa, McKay, Vivo, Soda, Crackelet, Oreo Chile." },
    { name: "Carnes y Fiambrería", focus: "Agrosuper, Ariztía, San Jorge, Llanquihue, Receta del Abuelo, PF Alimentos, La Crianza." },
    { name: "Marcas Propias Retail", focus: "Lider (Great Value, Selección, Equate), Jumbo (Cuisine & Co, Artemis), Tottus (Tottus, Precio Uno)." },
    { name: "Bebidas y Otros", focus: "Jugos Watt's, Andina, Snack Evercrisp (Lay's, Ramitas, Doritos chileno), Suplementos Whey." }
];

async function generateBatch(category, count = 80) {
    const prompt = `Actúa como un experto nutricionista chileno. Genera UNA LISTA de ${count} alimentos ÚNICOS para la categoría "${category.name}". 
  Foco: ${category.focus}.
  
  REGLA CRÍTICA: Debes incluir productos comerciales que se venden en supermercados chilenos (Lider, Jumbo, Unimarc).
  Ejemplo: "Yogurt Soprole Protein Frutilla", "Tallarines Carozzi N°5", "Atún Robinson Crusoe aceite".
  
  Los valores nutricionales deben ser por cada 100g de producto.
  Devuelve SOLO un array JSON con este formato exacto:
  [
    { "nombre": "Nombre exacto con marca", "categoria": "${category.name}", "estado": "crudo/cocido/n/a", "kcal": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "por_100g": 100 }
  ]`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error(`Error generando batch para ${category.name}:`, error);
        return [];
    }
}

async function run() {
    console.log("🚀 Iniciando expansión masiva de base de datos (Target: 3000+)");

    let totalInserted = 0;

    // 1. Obtener alimentos existentes para evitar duplicados
    const { data: existing } = await supabase.from('food_items').select('nombre, estado');
    const existingSet = new Set(existing?.map(e => `${e.nombre.toLowerCase()}|${e.estado?.toLowerCase() || 'n/a'}`) || []);

    console.log(`📊 Ya existen ${existingSet.size} alimentos en la base de datos.`);

    for (let i = 0; i < 15; i++) { // Más iteraciones
        console.log(`\n--- Bloque de Generación ${i + 1} ---`);

        for (const cat of categories) {
            console.log(`\nGenerando ${cat.name}...`);
            const foods = await generateBatch(cat, 60);

            if (foods.length > 0) {
                // Filtrar duplicados y validar estados
                const newFoods = foods.filter(f => {
                    const key = `${f.nombre.toLowerCase()}|${f.estado?.toLowerCase() || 'n/a'}`;
                    if (existingSet.has(key)) return false;
                    existingSet.add(key);
                    return true;
                }).map(f => {
                    // Asegurar que el estado sea uno de los permitidos por el check constraint
                    const allowed = ['crudo', 'cocido', 'n/a'];
                    const rawState = String(f.estado || '').toLowerCase().trim();
                    f.estado = allowed.includes(rawState) ? rawState : 'n/a';
                    return f;
                });

                if (newFoods.length > 0) {
                    const { error } = await supabase
                        .from('food_items')
                        .insert(newFoods);

                    if (error) {
                        console.error("Error en insert:", error);
                    } else {
                        totalInserted += newFoods.length;
                        console.log(`✅ Insertados ${newFoods.length} items nuevos de ${cat.name}. Total sesión: ${totalInserted}`);
                    }
                } else {
                    console.log(`⏭️ Todos los items de este batch de ${cat.name} ya existían.`);
                }
            }

            await new Promise(r => setTimeout(r, 1000));
        }
    }

    console.log(`\n🎉 Expansión finalizada. Se insertaron ${totalInserted} registros nuevos.`);
}

run();
