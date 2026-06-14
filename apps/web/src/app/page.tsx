import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/landing/hero";
import { AboutStats } from "@/components/landing/about-stats";
import { StudyAI } from "@/components/landing/study-ai";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Categories } from "@/components/landing/categories";
import { Payments } from "@/components/landing/payments";
import { Sellers } from "@/components/landing/sellers";
import { Testimonials } from "@/components/landing/testimonials";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default async function LandingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/explorar");

  return (
    <div className="landing-page min-h-screen">
      {/* 1. Hero — navbar + headline + buscador + trust signals */}
      <Hero />

      {/* 2. Quienes somos + Stats */}
      <AboutStats />

      {/* 3. Estudiá con IA — chat, modo estudio, búsqueda por temas */}
      <StudyAI />

      {/* 4. Como funciona — / 001, / 002, / 003 */}
      <HowItWorks />

      {/* 5. Categorias destacadas */}
      <Categories />

      {/* 6. Pagos y seguridad — Mercado Pago */}
      <Payments />

      {/* 7. Para vendedores + calculadora */}
      <Sellers />

      {/* 8. Testimonios */}
      <Testimonials />

      {/* 9. FAQ  */}
      <FAQ />

      {/* 10. CTA final */}
      <FinalCTA />

      {/* 11. Footer editorial */}
      <Footer />
    </div>
  );
}
