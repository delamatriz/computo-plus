// Pantallas de carga (nov-2026): las usan los loading.tsx de las secciones
// mientras el servidor arma la página, para que tocar un link del Sidebar
// cambie la pantalla al instante. Mismo marco que la página real (padding,
// tarjetas blancas con borde), con bloques grises en lugar del contenido.
// El AppShell (Header + Sidebar) lo pone el layout de cada sección, así que
// queda visible. Con "reducir movimiento" los bloques no laten.

function Bloque({ className = "" }: { className?: string }) {
  return <div className={`rounded-md bg-slate-200/70 motion-safe:animate-pulse ${className}`} />;
}

function Tarjeta({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate-200 rounded-xl shadow-sm ${className}`}>{children}</div>;
}

function Encabezado({ conBoton = false }: { conBoton?: boolean }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div className="space-y-2">
        <Bloque className="h-7 w-56" />
        <Bloque className="h-4 w-72 max-w-[60vw]" />
      </div>
      {conBoton && <Bloque className="h-9 w-36 rounded-lg" />}
    </div>
  );
}

function Contenedor({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-6 md:p-8" role="status" aria-busy="true" aria-label="Cargando">
      {children}
    </div>
  );
}

/** Panel de control: KPIs, gráfico y proyectos recientes. */
export function SkeletonPanel() {
  return (
    <Contenedor>
      <Encabezado />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }, (_, i) => (
          <Tarjeta key={i} className="p-5 space-y-2">
            <Bloque className="h-8 w-16" />
            <Bloque className="h-4 w-24" />
            <Bloque className="h-3 w-20" />
          </Tarjeta>
        ))}
      </div>
      <Tarjeta className="mb-8">
        <div className="p-5 border-b border-slate-100">
          <Bloque className="h-5 w-48" />
        </div>
        <div className="p-5">
          <Bloque className="h-48 w-full" />
        </div>
      </Tarjeta>
      <Tarjeta>
        <div className="p-5 border-b border-slate-100">
          <Bloque className="h-5 w-40" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-4 gap-4">
              <div className="space-y-2">
                <Bloque className="h-4 w-48 max-w-[50vw]" />
                <Bloque className="h-3 w-28" />
              </div>
              <Bloque className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Tarjeta>
    </Contenedor>
  );
}

/** Mis Proyectos: grilla de tarjetas. */
export function SkeletonListaProyectos() {
  return (
    <Contenedor>
      <Encabezado conBoton />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Tarjeta key={i} className="p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
              <Bloque className="h-6 w-20 rounded-full" />
              <Bloque className="h-3 w-16" />
            </div>
            <Bloque className="h-5 w-3/4 mb-2" />
            <Bloque className="h-4 w-1/2 mb-3" />
            <Bloque className="h-5 w-28 mb-3" />
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Bloque className="h-3 w-20" />
              <Bloque className="h-3 w-12" />
            </div>
          </Tarjeta>
        ))}
      </div>
    </Contenedor>
  );
}

/** Presupuesto de un proyecto: encabezado, totales y capítulos con rubros. */
export function SkeletonPresupuesto() {
  return (
    <div className="min-h-full p-4 md:p-6" style={{ background: "#F0F4F8" }} role="status" aria-busy="true" aria-label="Cargando proyecto">
      <Tarjeta className="p-5 mb-4 space-y-3">
        <Bloque className="h-7 w-64 max-w-[70vw]" />
        <Bloque className="h-4 w-40" />
      </Tarjeta>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Tarjeta key={i} className="p-4 space-y-2">
            <Bloque className="h-3 w-20" />
            <Bloque className="h-6 w-28" />
          </Tarjeta>
        ))}
      </div>
      <Tarjeta>
        {Array.from({ length: 3 }, (_, c) => (
          <div key={c} className="border-b border-slate-100 last:border-b-0">
            <div className="flex items-center gap-3 px-4 py-3 bg-slate-50/60">
              <Bloque className="h-4 w-8" />
              <Bloque className="h-4 w-48 max-w-[50vw]" />
              <Bloque className="h-4 w-24 ml-auto" />
            </div>
            {Array.from({ length: 3 }, (_, r) => (
              <div key={r} className="flex items-center gap-3 px-4 py-2.5">
                <Bloque className="h-3 w-10" />
                <Bloque className="h-3 flex-1 max-w-md" />
                <Bloque className="h-3 w-10" />
                <Bloque className="h-3 w-16 hidden sm:block" />
                <Bloque className="h-3 w-20" />
              </div>
            ))}
          </div>
        ))}
      </Tarjeta>
    </div>
  );
}

/** Pantalla genérica: título y una tabla (catálogos, configuración, listados). */
export function SkeletonPagina() {
  return (
    <Contenedor>
      <Encabezado />
      <Tarjeta>
        <div className="flex items-center gap-3 p-4 border-b border-slate-100">
          <Bloque className="h-9 flex-1 max-w-sm rounded-lg" />
          <Bloque className="h-9 w-28 rounded-lg" />
        </div>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <Bloque className="h-4 flex-1 max-w-lg" />
              <Bloque className="h-4 w-16 hidden sm:block" />
              <Bloque className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Tarjeta>
    </Contenedor>
  );
}

/** Visor de planos: pantalla completa, sin marco de la app. */
export function SkeletonVisor() {
  return (
    <div className="h-screen flex items-center justify-center bg-slate-100" role="status" aria-busy="true" aria-label="Cargando visor">
      <Bloque className="h-[70vh] w-[80vw] max-w-5xl rounded-xl" />
    </div>
  );
}
