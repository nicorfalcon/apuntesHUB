# Contexto del Proyecto
Actúa como un Senior Frontend Engineer experto en Next.js y React. 
Estamos desarrollando "ApuntesHUB", una plataforma real y escalable de venta de apuntes universitarios. 
Actualmente estás operando en una rama EXCLUSIVAMENTE de Frontend. NO debes crear, modificar ni sugerir cambios en archivos de backend (rutas de API, bases de datos, etc.). Asume que el endpoint `/api/pdf/[id]` ya existe y retorna correctamente un blob de un archivo PDF protegido (Status 200).

# El Problema
Necesitamos un componente visor de PDFs (`src/components/pdf-viewer.tsx`) robusto y profesional. 
Anteriormente intentamos usar un `<iframe>` nativo, pero los visores de los navegadores (Chrome, Firefox) exponen opciones de "Guardar como..." y "Descargar" que no se pueden bloquear al 100% solo con CSS.

# Objetivo
Crear un visor de PDFs escalable que renderice el documento de manera segura. El PDF DEBE poder leerse claramente (con scroll vertical natural), pero DEBE ser extremadamente difícil de descargar o copiar por el usuario promedio.

# Requerimientos Técnicos y de Seguridad (DRM Frontend)
Implementa una solución basada en el dibujo de páginas en `<canvas>` (por ejemplo, usando `react-pdf` / `pdf.js`) para evitar el uso del visor nativo del navegador. La solución debe cumplir con:

1. **Anti-Descarga Absoluta:** No debe existir el botón nativo de descarga. Bloquear el menú contextual (clic derecho) en todo el contenedor.
2. **Anti-Copia:** No debe renderizarse la capa de texto (TextLayer). El texto no debe ser seleccionable ni copiable.
3. **Protección de Teclado:** Implementar un `useEffect` que intercepte y haga `e.preventDefault()` en combinaciones clave: Ctrl+S (Guardar), Ctrl+P (Imprimir), Ctrl+U (Ver código) y F12.
4. **Watermark Dinámico:** Superponer una marca de agua en diagonal, repetida y fija (sticky/fixed), que muestre el `{userEmail}` pasado por props. Esta capa debe tener `pointer-events: none` y estar sobre el renderizado del PDF.
5. **Manejo de SSR en Next.js:** El motor de PDF.js suele romper en el servidor (errores como `Window is not defined` o `Object.defineProperty called on non-object`). DEBES estructurar el componente separando la lógica del cliente y usando `next/dynamic` con `{ ssr: false }` en la exportación principal para evitar crasheos de hidratación.
6. **UX:** Mientras se carga el motor del PDF (o el bundle del cliente), mostrar un spinner o skeleton de carga elegante.

# Entregables
1. Analiza el `package.json` y sugiere la instalación de la librería necesaria (ej. `react-pdf`) si no está presente.
2. Reescribe `src/components/pdf-viewer.tsx` (y divide en sub-componentes si lo consideras mejor para el SSR) cumpliendo todos los requerimientos.

Por favor, revisa el código actual en `src/components/pdf-viewer.tsx` para mantener los estilos Tailwind y la estructura visual, pero cambia la tecnología subyacente para cumplir este nivel de seguridad empresarial.