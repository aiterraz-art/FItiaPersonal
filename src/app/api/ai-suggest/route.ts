import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { deficit, macrosRestantes } = await req.json();

        // Logic for suggesting a meal based on deficit
        // In a real app, this would call an LLM with the context of the food database.
        // For this prototype, we'll return a "smart" suggestion based on which macro is most needed.

        let suggestion = {
            nombre: "Cena Equilibrada",
            kcal: deficit,
            p: macrosRestantes.p,
            c: macrosRestantes.c,
            g: macrosRestantes.g,
            mensaje: "He calculado esta comida para que completes tus macros exactamente. ¿Te parece bien?"
        };

        if (macrosRestantes.p > macrosRestantes.c && macrosRestantes.p > macrosRestantes.g) {
            suggestion.nombre = "Snack Proteico (Pollo o Atún)";
        } else if (macrosRestantes.c > macrosRestantes.p) {
            suggestion.nombre = "Cena de Carbohidratos (Arroz o Pasta)";
        }

        return NextResponse.json(suggestion);
    } catch (error) {
        return NextResponse.json({ error: 'Fallo al generar sugerencia' }, { status: 500 });
    }
}
