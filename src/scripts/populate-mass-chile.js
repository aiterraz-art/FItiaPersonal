const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
const model = genAI.getGenerativeModel({ model: "models/gemini-3-flash-preview" });

const categories = [
    { name: "Súper Mercados (Lider/Jumbo/Tottus)", focus: "Productos marca Great Value, Cuisine & Co, Tottus, Selección. Abarrotes, enlatados, congelados, snacks." },
    { name: "Lácteos Chilenos", focus: "Soprole, Colun, Nestlé, Quillayes, Chilolac. Yogures, leches, postres, quesos." },
    { name: "Panadería y Galletas CL", focus: "Ideal, Castaño, Galletas Costa, McKay, Vivo, Trania. Pan de molde, galletas dulces y saladas." },
    { name: "Carnes y Cecinas CL", focus: "Agrosuper, San Jorge, Llanquihue, PF, La Crianza, El Carnicero. Jamones, vienesas, cortes de carne." },
    { name: "Abarrotes y Despensa CL", focus: "Carozzi, Lucchetti, Tucapel, Banquete, Malloa, Wasil, Natur. Arroz, pastas, salsas, legumbres." },
    { name: "Bebidas y Liquidos CL", focus: "Watt's, Andina, CCU, Cachantún, Benedictino. Jugos, aguas, bebidas isotónicas, suplementos." },
    { name: "Snacks y Golosinas CL", focus: "Evercrisp, Fruna, Nestlé CL, Ambrosoli. Papas fritas, chocolates, ramitas, dulces chilenos." },
    { name: "Vegetales y Frutas", focus: "Vegetales frescos y congelados (Minuto Verde), frutas de estación mercado chileno." }
];

async function generateBatch(category, count = 100) {
    const prompt = `Actúa como un experto nutricionista chileno. Genera UNA LISTA de ${count} alimentos ÚNICOS y REALES para la categoría "${category.name}". 
  Foco: ${category.focus}.
  
  REGLA DE ORO: Debes incluir productos de marcas que se venden en CHILE (Soprole, Colun, Carozzi, Great Value, Cuisine & Co, etc.).
  
  Los valores nutricionales deben ser por cada 100g de producto.
  Devuelve SOLO un array JSON con este formato exacto:
  [
    { "nombre": "Nombre exacto + Marca (Ej: Yogurt Soprole Protein Vainilla)", "categoria": "${category.name}", "estado": "crudo/cocido/n/a", "kcal": 0, "proteinas": 0, "carbohidratos": 0, "grasas": 0, "por_100g": 100 }
  ]`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (error) {
        console.error(`Error en ${category.name}:`, error.message);
        return [];
    }
}

async function run() {
    console.log("🚀 EXPLOSIÓN DE DATOS CHILE (Target: 3000+)");

    // 1. Obtener existentes para el Set de duplicados
    const { data: existing } = await supabase.from('food_items').select('nombre, estado');
    const existingSet = new Set(existing?.map(e => `${e.nombre.toLowerCase()}|${e.estado?.toLowerCase() || 'n/a'}`) || []);
    console.log(`📊 Base actual: ${existingSet.size} items.`);

    let totalInserted = 0;
    const allowedStates = ['crudo', 'cocido', 'n/a'];

    // Procesamos en 10 ciclos masivos
    for (let i = 0; i < 10; i++) {
        console.log(`\n📦 CICLO DE CARGA ${i + 1} / 10`);

        // Generamos TODAS las categorías en paralelo
        const tasks = categories.map(cat => generateBatch(cat, 80));
        const results = await Promise.all(tasks);

        for (let j = 0; j < results.length; j++) {
            const foods = results[j];
            if (foods && foods.length > 0) {
                const newFoods = foods.filter(f => {
                    const key = `${String(f.nombre).toLowerCase()}|${String(f.estado || 'n/a').toLowerCase()}`;
                    if (existingSet.has(key)) return false;
                    existingSet.add(key);
                    return true;
                }).map(f => ({
                    ...f,
                    estado: allowedStates.includes(String(f.estado).toLowerCase()) ? String(f.estado).toLowerCase() : 'n/a'
                }));

                if (newFoods.length > 0) {
                    const { error } = await supabase.from('food_items').insert(newFoods);
                    if (!error) {
                        totalInserted += newFoods.length;
                        console.log(`✅ [${categories[j].name}] +${newFoods.length} items. (Total: ${existingSet.size})`);
                    } else {
                        console.error(`❌ Error en ${categories[j].name}:`, error.message);
                    }
                }
            }
        }

        console.log(`⏳ Esperando 5s para enfriar API...`);
        await new Promise(r => setTimeout(r, 5000));
    }

    console.log(`\n🎉 COMPLETADO. Total en DB: ${existingSet.size}`);
}

run();
