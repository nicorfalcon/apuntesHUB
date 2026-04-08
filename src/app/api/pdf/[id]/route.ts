import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "sample.pdf");
    console.log("Intentando leer PDF en:", filePath); // Esto saldrá en tu terminal de Debian
    
    const fileBuffer = await readFile(filePath);
    console.log("Archivo leído con éxito, tamaño:", fileBuffer.length);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
        // Recordá que aquí NO va el X-Frame-Options
      },
    });
  } catch (error) {
    console.error("ERROR en la API de PDF:", error);
    return NextResponse.json({ error: "Error al cargar el archivo" }, { status: 500 });
  }
}