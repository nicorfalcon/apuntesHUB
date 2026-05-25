import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptApiKey } from "@/lib/crypto/api-key-encryption";
import { validateApiKey } from "@/lib/ai/validate-key";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const admin = createAdminClient();
  const { data: keys, error } = await admin
    .from("user_api_keys")
    .select("id, provider, display_name, model_id, key_hint, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ keys: keys ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { provider?: string; displayName?: string; modelId?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { provider, displayName, modelId, apiKey } = body;

  if (!provider || !displayName || !apiKey) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 });
  }
  if (!["openai", "gemini", "custom"].includes(provider)) {
    return NextResponse.json({ error: "Proveedor no soportado" }, { status: 400 });
  }
  if (apiKey.length < 10) {
    return NextResponse.json({ error: "API key inválida" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Límite: máximo 5 keys por usuario
  const { count } = await admin
    .from("user_api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: "Límite de 5 API keys alcanzado" }, { status: 429 });
  }

  // Verificar que la key funciona antes de guardarla
  const isValid = await validateApiKey(provider, apiKey);
  if (!isValid) {
    return NextResponse.json(
      { error: "La API key no es válida o no tiene permisos suficientes" },
      { status: 422 }
    );
  }

  const { encrypted, iv } = encryptApiKey(apiKey);
  const keyHint = `...${apiKey.slice(-4)}`;

  const defaultModels: Record<string, string> = {
    openai: "gpt-4o",
    gemini: "gemini-2.5-flash",
    custom: "",
  };

  const { data: newKey, error } = await admin
    .from("user_api_keys")
    .insert({
      user_id: user.id,
      provider,
      display_name: displayName,
      model_id: modelId || defaultModels[provider] || null,
      key_encrypted: encrypted,
      key_iv: iv,
      key_hint: keyHint,
    })
    .select("id, provider, display_name, model_id, key_hint, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ key: newKey }, { status: 201 });
}
