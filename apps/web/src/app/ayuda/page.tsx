import Link from "next/link";
import {
  GraduationCap,
  Store,
  UserRound,
  Search,
  ShoppingCart,
  CalendarCheck,
  Sparkles,
  Library,
  KeyRound,
  PlayCircle,
  FileUp,
  Tags,
  Percent,
  Ticket,
  Package,
  Wallet,
  BarChart3,
  MessageSquare,
  Bell,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Centro de ayuda · apuntesHUB",
  description:
    "Guías paso a paso para estudiantes, vendedores y profesores de apuntesHUB.",
};

interface HowTo {
  icon: LucideIcon;
  q: string;
  steps: string[];
  tip?: string;
}

interface Section {
  id: string;
  label: string;
  eyebrow: string;
  title: string;
  intro: string;
  icon: LucideIcon;
  items: HowTo[];
}

const SECTIONS: Section[] = [
  {
    id: "estudiantes",
    label: "Estudiantes",
    eyebrow: "Para estudiantes",
    title: "Encontrar, comprar y estudiar",
    intro:
      "Todo lo que podés hacer para preparar mejor tus materias: buscar material, comprarlo, reservar clases y estudiar con la IA.",
    icon: GraduationCap,
    items: [
      {
        icon: Search,
        q: "Buscar un apunte por tema",
        steps: [
          "Entrá a Explorar y quedate en la pestaña Apuntes.",
          "Escribí en el buscador. Activá el toggle “Buscar por tema” para que la IA encuentre apuntes por concepto (ej: “Le Chatelier” o “derivadas parciales”) aunque no aparezca en el título.",
          "Afiná con los filtros de Universidad, Carrera, Materia y Precio.",
          "Usá el filtro “Con descuento” para ver solo el material rebajado.",
        ],
        tip: "Los apuntes muestran sus “Temas” como etiquetas: te sirven para saber qué cubre cada uno de un vistazo.",
      },
      {
        icon: ShoppingCart,
        q: "Comprar un apunte",
        steps: [
          "Abrí el apunte y revisá la vista previa (páginas de muestra).",
          "Tocá “Comprar apunte”, o “Agregar al carrito” si querés juntar varios del mismo vendedor y pagarlos en un solo pago.",
          "Si tenés un código de descuento, ingresalo antes de pagar.",
          "Completás el pago de forma segura con Mercado Pago. Si el apunte es gratis, aparece “Obtener gratis”.",
        ],
        tip: "El carrito agrupa por vendedor: cada vendedor se cobra por separado.",
      },
      {
        icon: PlayCircle,
        q: "Comparar y elegir un curso grabado",
        steps: [
          "En Explorar entrá a la pestaña Grabadas.",
          "Cada curso muestra el tipo (curso completo, repaso final o resolución de TPs), la duración, la cantidad de módulos, la materia y su valoración.",
          "Filtrá por Tipo, Duración, Materia o Universidad para comparar.",
          "Tocá “Ver” para abrir el detalle con el temario completo y el precio antes de inscribirte.",
        ],
      },
      {
        icon: CalendarCheck,
        q: "Reservar una clase con un profesor",
        steps: [
          "En Explorar entrá a Profesores particulares y filtrá por materia, modalidad (online/presencial), disponibilidad y tarifa.",
          "Abrí el perfil del profesor, elegí un horario disponible y confirmá la reserva.",
          "Pagás la clase con Mercado Pago.",
          "Cuando la reserva queda confirmada, coordinás los detalles por Mensajes.",
        ],
      },
      {
        icon: Sparkles,
        q: "Estudiar con la IA",
        steps: [
          "Abrí un apunte comprado desde Mi biblioteca y entrá a “Estudiar”.",
          "Preguntale a la IA sobre el contenido: te responde apoyándose en el material del apunte.",
          "Podés pedirle resúmenes, que te explique un tema o que te tome preguntas de repaso.",
        ],
        tip: "Para usar tu propia cuota de IA, conectá tu API key personal (ver más abajo).",
      },
      {
        icon: Library,
        q: "Dónde están mis apuntes y cursos comprados",
        steps: [
          "Todo vive en Mi biblioteca: apuntes comprados, cursos activos y tus carpetas de estudio.",
          "Usá el toggle Apuntes / Cursos para cambiar de vista.",
          "Creá carpetas para ordenar tus apuntes por materia o cuatrimestre.",
        ],
      },
      {
        icon: Bell,
        q: "Elegir qué avisos por mail recibís",
        steps: [
          "Andá a tu Perfil y abrí la sección “Notificaciones”.",
          "Activá o desactivá cada tipo de aviso: Ventas, Consultas sobre tu material, Respuestas a tus consultas y Clases particulares.",
          "Los cambios se guardan solos: no hay botón de guardar.",
        ],
        tip: "Por defecto recibís todos. Los mails de tu cuenta (verificación y recuperación de contraseña) se mandan siempre.",
      },
      {
        icon: KeyRound,
        q: "Conectar tu API key personal para la IA",
        steps: [
          "Andá a tu Perfil y abrí la sección “Modelos IA”.",
          "Pegá tu API key personal del proveedor y guardá.",
          "Desde ese momento la IA de estudio usa tu clave y tu propia cuota.",
        ],
        tip: "Tu clave se guarda de forma segura y podés quitarla cuando quieras.",
      },
    ],
  },
  {
    id: "vendedores",
    label: "Vendedores",
    eyebrow: "Para vendedores",
    title: "Publicar y vender tu material",
    intro:
      "Subí tus apuntes, ponéles precio, sumá descuentos y cobrá con Mercado Pago. Todo se gestiona desde el Panel de ventas.",
    icon: Store,
    items: [
      {
        icon: FileUp,
        q: "Publicar un apunte",
        steps: [
          "Entrá a Vender → “Nueva publicación” y elegí Apunte.",
          "Completá título, materia, carrera y universidad.",
          "Subí el PDF y poné el precio (podés publicarlo gratis ingresando 0).",
          "Publicá: recibís el 90% de cada venta (la plataforma retiene un 10%).",
        ],
      },
      {
        icon: Tags,
        q: "Cargar y editar los temas del apunte",
        steps: [
          "Al subir el PDF, apuntesHUB sugiere automáticamente los temas leyendo el índice del documento.",
          "Revisá los temas sugeridos y editá, borrá o agregá los que quieras (hasta 30).",
          "Si es un apunte ya subido, abrilo en editar y tocá “Sugerir del índice del PDF”.",
        ],
        tip: "Buenos temas mejoran que te encuentren con la “Búsqueda por tema”.",
      },
      {
        icon: Percent,
        q: "Aplicar un descuento directo a un apunte (sin código)",
        steps: [
          "En el Panel de ventas, abrí el menú ⋮ del apunte y entrá a “Precio y descuento”.",
          "Cargá el porcentaje de descuento (0–90%). Vas a ver una vista previa del precio final para el comprador.",
          "Guardá: el apunte queda destacado en Explorar con la etiqueta “−X%” y muestra el precio tachado.",
          "Para quitarlo, volvé al mismo lugar y poné el descuento en 0.",
        ],
        tip: "El descuento sale de tu parte; la comisión se calcula sobre el monto ya descontado. En cursos grabados el descuento se pone desde el control “Descuento” de cada curso en el Panel.",
      },
      {
        icon: Ticket,
        q: "Crear códigos de descuento",
        steps: [
          "En el Panel de ventas entrá a “Códigos de descuento” → “Nuevo código”.",
          "Elegí el código (ej: PARCIAL20), el tipo (porcentaje % o monto fijo $) y el valor.",
          "Opcional: poné un límite de usos y una fecha de vencimiento.",
          "Tus compradores ingresan el código al pagar cualquiera de tus apuntes publicados.",
        ],
        tip: "El uso se cuenta recién cuando la compra se completa, así un checkout abandonado no consume un uso. Podés desactivar o eliminar un código cuando quieras.",
      },
      {
        icon: Package,
        q: "Armar un paquete de apuntes",
        steps: [
          "Panel de ventas → “Paquetes” → “Nuevo paquete”.",
          "Elegí dos o más de tus apuntes y poné un precio único para el combo.",
          "Publicalo: el comprador se lo lleva en un solo pago y recibe todos los apuntes.",
        ],
      },
      {
        icon: Sparkles,
        q: "Procesar un apunte con IA",
        steps: [
          "En el menú ⋮ del apunte, tocá “Procesar con IA”.",
          "Esto genera la vista previa protegida y prepara el material para la “Búsqueda por tema” y el estudio con IA.",
          "Si aparece “IA error”, reprocesá desde el mismo menú.",
        ],
      },
      {
        icon: BarChart3,
        q: "Ver mis ventas e ingresos",
        steps: [
          "El Panel de ventas muestra ingresos estimados, publicaciones, ventas y estado de tus tutorías.",
          "En Inventario cambiás entre Apuntes, Cursos grabados, Consultas y Clases sin scrollear listas largas.",
        ],
        tip: "Desde Vender podés entrar directo con “Ir al panel de ventas”.",
      },
      {
        icon: Bell,
        q: "Recibir un mail cada vez que te compran",
        steps: [
          "Está activado por defecto: cuando alguien compra un apunte, un paquete o un curso tuyo, te llega un mail con el detalle del cobro (monto, comisión y lo que cobrás).",
          "Si no querés recibirlos, entrá a Perfil → Notificaciones y desactivá “Ventas”.",
          "Lo mismo con “Consultas sobre tu material”: el aviso de cada consulta nueva de un comprador.",
        ],
        tip: "Desactivar el aviso no afecta la venta: siempre podés ver todo en el Panel de ventas.",
      },
    ],
  },
  {
    id: "profesores",
    label: "Profesores",
    eyebrow: "Para profesores",
    title: "Dar clases particulares",
    intro:
      "Configurá tu perfil de profesor, publicá tus materias y disponibilidad, y recibí reservas pagas.",
    icon: UserRound,
    items: [
      {
        icon: UserRound,
        q: "Configurar tu perfil de profesor",
        steps: [
          "Entrá a Clases → “Configurar perfil de profesor” (o desde tu menú de usuario, “Perfil de profesor”).",
          "Completá tu bio, las materias que enseñás, la tarifa por hora y la modalidad.",
          "Cargá tu disponibilidad horaria para que los alumnos puedan reservar.",
        ],
        tip: "La comisión de las clases es del 2,5%: te quedás con el 97,5% de tu tarifa. Al cargar el precio por hora te mostramos cuánto cobrás por cada clase.",
      },
      {
        icon: CalendarCheck,
        q: "Gestionar reservas y clases",
        steps: [
          "En Clases ves tus clases Próximas, Pasadas y Canceladas.",
          "Cuando un alumno reserva y paga, la clase queda confirmada.",
          "Coordinás los detalles de cada clase por Mensajes.",
        ],
      },
      {
        icon: MessageSquare,
        q: "Coordinar por mensajes",
        steps: [
          "Cada conversación en Mensajes corresponde a una reserva confirmada.",
          "Usá el chat para acordar horario, plataforma o punto de encuentro con el alumno.",
        ],
      },
    ],
  },
];

// Sección compartida (aplica a vendedores y profesores): cobrar con Mercado Pago.
const MP_SECTION: HowTo = {
  icon: Wallet,
  q: "Conectar tu cuenta de Mercado Pago para cobrar",
  steps: [
    "Andá a tu Perfil y abrí la sección “Pagos”.",
    "Tocá “Conectar Mercado Pago” y autorizá el acceso con tu cuenta.",
    "Una vez conectada, tus apuntes, cursos y clases quedan disponibles para la venta y los cobros llegan directo a tu cuenta.",
  ],
  tip: "Sin Mercado Pago conectado, tu material aparece pero no se puede comprar. Podés desconectarlo cuando quieras.",
};

function HowToItem({ item }: { item: HowTo }) {
  const Icon = item.icon;
  return (
    <details className="group border-b border-gray-200/80 last:border-b-0 dark:border-white/10">
      <summary className="flex cursor-pointer list-none items-center gap-3.5 rounded-lg py-4 transition-colors [touch-action:manipulation] hover:text-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300/40 dark:hover:text-accent-100">
        <Icon
          className="h-[18px] w-[18px] shrink-0 text-accent-600 dark:text-accent-300"
          strokeWidth={1.8}
        />
        <span className="flex-1 text-[15px] font-semibold text-foreground transition-colors group-hover:text-accent-700 dark:group-hover:text-accent-100">
          {item.q}
        </span>
        <svg
          className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="pb-5 pl-[31px]">
        <ol className="space-y-2.5">
          {item.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm leading-6 text-muted-foreground">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-50 text-[11px] font-bold tabular-nums text-accent-700 dark:bg-accent-300/15 dark:text-accent-200">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {item.tip && (
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            <span className="font-semibold text-accent-700 dark:text-accent-200">
              Tip:
            </span>{" "}
            {item.tip}
          </p>
        )}
      </div>
    </details>
  );
}

export default function AyudaPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
        Volver al inicio
      </Link>

      <header className="mt-6 mb-12 max-w-2xl">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-accent-700 dark:text-accent-200">
            Centro de ayuda
          </span>
          <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
        </div>
        <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          ¿Qué querés hacer?
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-7 text-muted-foreground">
          Guías paso a paso, organizadas por rol. Elegí una acción y desplegá el
          instructivo. Si no encontrás lo que buscás, escribinos al final.
        </p>
      </header>

      <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[190px_minmax(0,1fr)]">
        {/* Índice lateral */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-0.5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
              Secciones
            </p>
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent-50 hover:text-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300/50 dark:hover:bg-white/5 dark:hover:text-accent-100"
                >
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
                  {s.label}
                </a>
              );
            })}
            <a
              href="#contacto"
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent-50 hover:text-accent-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300/50 dark:hover:bg-white/5 dark:hover:text-accent-100"
            >
              <MessageSquare className="h-4 w-4 shrink-0" strokeWidth={1.8} />
              Escribinos
            </a>
          </nav>
        </aside>

        {/* Contenido */}
        <div className="space-y-16">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isSeller = section.id === "vendedores";
            const isTeacher = section.id === "profesores";
            return (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <div className="flex items-center gap-3">
                  <Icon
                    className="h-4 w-4 text-accent-600 dark:text-accent-300"
                    strokeWidth={1.9}
                  />
                  <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-700 dark:text-accent-200">
                    {section.eyebrow}
                  </span>
                  <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                </div>
                <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight text-foreground">
                  {section.title}
                </h2>
                <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
                  {section.intro}
                </p>

                <div className="mt-4 border-t border-gray-200/80 dark:border-white/10">
                  {section.items.map((item) => (
                    <HowToItem key={item.q} item={item} />
                  ))}
                  {/* Cobrar con MP aplica a vendedores y profesores */}
                  {(isSeller || isTeacher) && <HowToItem item={MP_SECTION} />}
                </div>
              </section>
            );
          })}

          {/* Contacto: formulario que envía un mail al equipo */}
          <section id="contacto" className="scroll-mt-24">
            <div className="flex items-center gap-3">
              <MessageSquare
                className="h-4 w-4 text-accent-600 dark:text-accent-300"
                strokeWidth={1.9}
              />
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-accent-700 dark:text-accent-200">
                ¿Seguís con dudas?
              </span>
              <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
            </div>
            <h2 className="mt-4 text-balance text-2xl font-bold tracking-tight text-foreground">
              Escribinos y te ayudamos.
            </h2>
            <p className="mt-3 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">
              Contanos qué te pasó o qué estabas buscando y dejanos tu email. Te
              respondemos ahí mismo, lo antes posible.
            </p>

            <div className="mt-5">
              <ContactForm />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
