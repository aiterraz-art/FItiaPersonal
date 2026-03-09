import { NextResponse } from "next/server";

export const AI_FEATURES_ENABLED = false;

export function aiDisabledResponse() {
  return NextResponse.json(
    { error: "Funciones de IA desactivadas" },
    { status: 403 }
  );
}
