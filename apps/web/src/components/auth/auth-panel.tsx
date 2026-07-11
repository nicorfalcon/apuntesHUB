type AuthPanelProps = {
  /** Ruta de la imagen de fondo. Por defecto la foto de login. */
  image?: string;
  /** Texto alternativo de la imagen. */
  alt?: string;
  /** Título mostrado sobre la imagen. */
  title?: string;
  /** Subtítulo mostrado sobre la imagen. */
  subtitle?: string;
};

/**
 * Panel lateral ilustrado de las pantallas de autenticación
 * (login, registro, recuperar/restablecer contraseña).
 *
 * La imagen tiene una animación sutil "Ken Burns" (zoom + paneo) más un
 * brillo que la recorre, definidas en globals.css y desactivadas
 * automáticamente con `prefers-reduced-motion`.
 */
export function AuthPanel({
  image = "/images/login-photo.jpg",
  alt = "Estudiantes colaborando",
  title = "Compartí y descubrí apuntes",
  subtitle = "La comunidad universitaria que te ayuda a estudiar mejor",
}: AuthPanelProps) {
  return (
    <div className="relative hidden overflow-hidden lg:block lg:w-1/2">
      <img src={image} alt={alt} className="animate-ken-burns h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[#2D6A4F]/70" />
      <div className="animate-auth-sheen" />
      <div className="absolute inset-0 flex flex-col justify-end p-12">
        <h2 className="text-3xl font-bold text-white">{title}</h2>
        <p className="mt-3 max-w-md text-lg text-white/90">{subtitle}</p>
      </div>
    </div>
  );
}
