import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { getApunteById } from "@/lib/mock-data";

// Sirve el PDF como blob binario — nunca expone la URL directa del archivo
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const apunte = getApunteById(params.id);
  if (!apunte) {
    return NextResponse.json({ error: "Apunte no encontrado" }, { status: 404 });
  }

  try {
    const filePath = join(process.cwd(), "public", "sample.pdf");
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        // Evitar caching y descarga directa
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al cargar el archivo" },
      { status: 500 }
    );
  }
}
