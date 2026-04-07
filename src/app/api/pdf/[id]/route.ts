import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

// Sirve el PDF de demo como blob binario — nunca expone la URL directa del archivo
export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "sample.pdf");
    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al cargar el archivo" }, { status: 500 });
  }
}
