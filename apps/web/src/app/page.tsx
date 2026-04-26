import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Hero } from "@/components/landing/hero";
import { AboutStats } from "@/components/landing/about-stats";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Categories } from "@/components/landing/categories";
import { Payments } from "@/components/landing/payments";
import { Sellers } from "@/components/landing/sellers";
import { Testimonials } from "@/components/landing/testimonials";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default async function LandingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/browse");

  return (
    <div className="landing-page min-h-screen">
      {/* 1. Hero — navbar + headline + buscador + trust signals */}
      <Hero />

      {/* 3. Quienes somos + Stats */}
      <AboutStats />

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

      {/* 9. Precios */}
      <Pricing />

      {/* 10. FAQ */}
      <FAQ />

      {/* 11. CTA final */}
      <FinalCTA />

      {/* 12. Footer editorial */}
      <Footer />
    </div>
  );
}
