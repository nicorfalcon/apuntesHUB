import { NextResponse } from "next/server";

export function isDocumentNavigationRequest(request: Request) {
  const destination = request.headers.get("sec-fetch-dest");
  const mode = request.headers.get("sec-fetch-mode");
  const accept = request.headers.get("accept") ?? "";

  return (
    destination === "document" ||
    destination === "iframe" ||
    mode === "navigate" ||
    accept.includes("text/html")
  );
}

export function mediaEndpointNavigationResponse() {
  return NextResponse.json({ error: "No encontrado" }, { status: 404 });
}
