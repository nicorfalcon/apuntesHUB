import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        // supabase-js consulta PostgREST con fetch, y Next parchea fetch para cachear
        // con force-cache en las rutas que no son dinámicas. Sin esto, un GET a la base
        // desde un route handler estático queda congelado en el Data Cache: la vista
        // previa seguía respondiendo 'pending' aunque el worker ya la hubiera marcado
        // 'ready'. Nunca queremos servir estado de la base desde caché.
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      },
    }
  );
}
