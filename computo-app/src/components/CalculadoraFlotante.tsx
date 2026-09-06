"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Calculator, X } from "lucide-react";
import { cn } from "@/lib/utils";

const MODOS = [
  { id: "basica",    label: "Básica" },
  { id: "superficie", label: "Superficie" },
  { id: "volumen",   label: "Volumen" },
  { id: "mezclas",   label: "Mezclas" },
] as const;

type Modo = (typeof MODOS)[number]["id"];

// Mortero — SOLO cemento:arena (sin pedregullo). "1:3:3 (tabiques)" y
// "1:3:6 (contrapisos)" de la versión anterior en realidad no llevaban
// piedra en la práctica — eran morteros, no hormigón; de ahí este
// rediseño (ver Toggle Mortero/Hormigón más abajo). "Premezcla" no entra
// acá — es un modelo distinto (bolsas de producto terminado, no
// proporción de componentes crudos), manejado aparte en el cálculo.
const MORTEROS = [
  { id: "asiento",        label: "Asiento de mampostería (1:4)", cemento: 1, arena: 4 },
  { id: "revoque-grueso", label: "Revoque grueso (1:3)",         cemento: 1, arena: 3 },
  { id: "revoque-fino",   label: "Revoque fino / enlucido (1:5)", cemento: 1, arena: 5 },
  { id: "premezcla",      label: "Mortero común (premezcla)" },
] as const;

// Hormigón — cemento:arena:pedregullo. "Ciclópeo" no tiene proporción
// propia acá: se resuelve como 1:2:4 sobre el 60% del volumen + piedra
// partida aparte (ver cálculo en el componente).
const HORMIGONES = [
  { id: "estructural",  label: "Estructural (1:2:3)",  cemento: 1, arena: 2, pedregullo: 3 },
  { id: "uso-general",  label: "Uso general (1:2:4)",  cemento: 1, arena: 2, pedregullo: 4 },
  { id: "ciclopeo",     label: "Hormigón Ciclópeo" },
] as const;

const DENSIDAD_CEMENTO = 1400; // kg/m³
const DENSIDAD_ARIDO   = 1500; // kg/m³
const FACTOR_ESPONJAMIENTO = 1.5; // m³ de áridos sueltos por m³ de hormigón/mortero compactado

// Mortero común premezclado (bolsa de 25kg) — modelo distinto al de
// proporción de componentes crudos: acá no se dosifica cemento/arena por
// separado, se calcula directo cuántas bolsas de producto terminado
// hacen falta. Valor estimativo (rendimiento real de bolsa por m³) —
// ajustar si difiere según marca/proveedor.
const RENDIMIENTO_BOLSA_MEZCLA = 0.014; // m³ por bolsa de 25kg

// Hormigón Ciclópeo — pedregullo grueso (15-30cm de diámetro) desplaza
// el 40% del volumen total, el 60% restante se llena con hormigón 1:2:4
// normal (fuente: CYPE Uruguay, referencia de hormigón ciclópeo).
const PROPORCION_HORMIGON_CICLOPEO = 0.6;
const PROPORCION_PIEDRA_PARTIDA_CICLOPEO = 0.4;

function fmtNum(v: number, decimals = 2) {
  if (!isFinite(v)) return "-";
  return v.toLocaleString("es-UY", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function CalculadoraFlotante() {
  const pathname = usePathname();
  // Visible/oculta — a diferencia del viejo "abierta", nunca desmonta el
  // panel de abajo: ocultar cambia solo el atributo `hidden` (CSS), no la
  // presencia en el árbol. Antes el panel vivía dentro de {abierta && (...)},
  // así que cerrar (click afuera del modal) destruía React el componente
  // entero — y con él, la cuenta en curso de CalculadoraBasica.
  const [visible, setVisible] = useState(false);
  const [modo, setModo] = useState<Modo>("basica");

  // Posición del panel al arrastrarlo — null hasta el primer arrastre
  // (mientras tanto se ancla por CSS arriba del botón circular, `style`
  // más abajo). Se fija en píxeles absolutos recién en iniciarArrastre,
  // leyendo la posición real ya renderizada — así no hace falta calcular
  // nada de memoria antes de que exista el layout (SSR-safe: sin usar
  // `window` en el render).
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Offset del click dentro del panel al empezar a arrastrar — ref porque
  // se lee/escribe desde el listener de mousemove, no dispara render.
  const arrastreRef = useRef<{ offsetX: number; offsetY: number } | null>(null);

  // mousemove/mouseup en window (no en el panel): el mouse sale del panel
  // apenas se mueve rápido, y el arrastre tiene que seguir funcionando —
  // mismo patrón estándar de "drag manual" sin librería.
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!arrastreRef.current || !panelRef.current) return;
      const panel = panelRef.current;
      const w = panel.offsetWidth;
      const h = panel.offsetHeight;
      // Clamp contra el viewport — el panel nunca queda fuera de pantalla.
      const x = Math.min(Math.max(0, e.clientX - arrastreRef.current.offsetX), window.innerWidth - w);
      const y = Math.min(Math.max(0, e.clientY - arrastreRef.current.offsetY), window.innerHeight - h);
      setPos({ x, y });
    }
    function onMouseUp() {
      arrastreRef.current = null;
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const iniciarArrastre = (e: React.MouseEvent) => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    arrastreRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
    if (!pos) setPos({ x: rect.left, y: rect.top });
    e.preventDefault();
  };

  if (!pathname.startsWith("/proyectos")) return null;

  return (
    <>
      <button
        onClick={() => setVisible(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center transition-colors"
        style={{ boxShadow: "0 8px 24px 0 rgb(37 99 235 / 0.4)" }}
        aria-label="Abrir calculadora"
      >
        <Calculator className="w-6 h-6" />
      </button>

      {/* Panel flotante — sin overlay ni bloqueo de clicks: el resto de la
          pantalla (presupuesto de fondo) sigue completamente interactivo
          mientras está abierto. Montado siempre (nunca condicionado a
          `visible`) — ocultar con `hidden` en vez de desmontar es lo que
          deja la cuenta en curso intacta al volver a abrir. */}
      <div
        ref={panelRef}
        hidden={!visible}
        className="fixed z-50 bg-white rounded-[16px] w-full max-w-sm shadow-xl"
        style={pos ? { left: pos.x, top: pos.y } : { right: 24, bottom: 96 }}
      >
        {/* Header — a la vez barra de arrastre (mousedown acá mueve el
            panel); el botón de cerrar corta la propagación para no
            arrastrar sin querer al hacer click en él. */}
        <div
          onMouseDown={iniciarArrastre}
          className="flex items-center justify-between px-5 py-4 border-b border-slate-200 cursor-move select-none"
        >
          <h2 className="text-sm font-bold text-[#1A3A5C]">Calculadora de obra</h2>
          <button
            onClick={() => setVisible(false)}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Ocultar calculadora"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-4 gap-1 px-3 pt-3">
          {MODOS.map((m) => (
            <button
              key={m.id}
              onClick={() => setModo(m.id)}
              className={cn(
                "py-2 rounded-[8px] text-xs font-semibold transition-all text-center",
                modo === m.id
                  ? "bg-blue-50 text-[#2563EB]"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {modo === "basica" && <CalculadoraBasica activo={visible} />}
          {modo === "superficie" && <CalculadoraSuperficie />}
          {modo === "volumen" && <CalculadoraVolumen />}
          {modo === "mezclas" && <CalculadoraMezclas />}
        </div>
      </div>
    </>
  );
}

/* ─── Básica ──────────────────────────────────────────────── */
// `activo` — true mientras el panel está visible en esta pestaña; dispara
// el foco automático del contenedor (ver useEffect abajo) para que el
// teclado físico funcione apenas se abre, sin necesidad de clickear un
// botón primero. El estado de la cuenta (display, prevValue, etc.) vive
// en este componente sin cambios — sobrevive solo porque el padre ya no
// desmonta el árbol al ocultar el panel (ver CalculadoraFlotante).
function CalculadoraBasica({ activo }: { activo: boolean }) {
  const [display, setDisplay] = useState("0");
  const [prevValue, setPrevValue] = useState<number | null>(null);
  const [operador, setOperador] = useState<string | null>(null);
  const [esperandoOperando, setEsperandoOperando] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activo) contenedorRef.current?.focus();
  }, [activo]);

  const inputDigito = (d: string) => {
    if (esperandoOperando) {
      setDisplay(d);
      setEsperandoOperando(false);
    } else {
      setDisplay(display === "0" ? d : display + d);
    }
  };

  const inputDecimal = () => {
    if (esperandoOperando) {
      setDisplay("0.");
      setEsperandoOperando(false);
      return;
    }
    if (!display.includes(".")) setDisplay(display + ".");
  };

  const limpiar = () => {
    setDisplay("0");
    setPrevValue(null);
    setOperador(null);
    setEsperandoOperando(false);
  };

  const calcular = (a: number, b: number, op: string) => {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "×": return a * b;
      case "÷": return b === 0 ? NaN : a / b;
      default:  return b;
    }
  };

  const seleccionarOperador = (op: string) => {
    const valor = parseFloat(display);
    if (prevValue === null) {
      setPrevValue(valor);
    } else if (operador) {
      const resultado = calcular(prevValue, valor, operador);
      setDisplay(String(resultado));
      setPrevValue(resultado);
    }
    setEsperandoOperando(true);
    setOperador(op);
  };

  const igual = () => {
    const valor = parseFloat(display);
    if (prevValue !== null && operador) {
      const resultado = calcular(prevValue, valor, operador);
      setDisplay(String(resultado));
      setPrevValue(null);
      setOperador(null);
      setEsperandoOperando(true);
    }
  };

  // Backspace — borra el último carácter, no existía como botón en
  // pantalla (solo "C" borra todo). Deja "0" en vez de string vacío.
  const borrarUltimo = () => {
    setDisplay((d) => (d.length > 1 ? d.slice(0, -1) : "0"));
  };

  // Teclado físico — dispara las MISMAS funciones que ya usa cada botón,
  // sin duplicar lógica de cálculo acá. Foco en el propio contenedor (no
  // un listener global de document): así tipear en cualquier otro campo
  // de la pantalla (ej. Cantidad de un rubro) mientras el panel sigue
  // abierto no interfiere con la calculadora ni viceversa.
  const manejarTeclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key >= "0" && e.key <= "9") { e.preventDefault(); inputDigito(e.key); return; }
    if (e.key === "," || e.key === ".") { e.preventDefault(); inputDecimal(); return; }
    if (e.key === "+") { e.preventDefault(); seleccionarOperador("+"); return; }
    if (e.key === "-") { e.preventDefault(); seleccionarOperador("-"); return; }
    if (e.key === "*") { e.preventDefault(); seleccionarOperador("×"); return; }
    if (e.key === "/") { e.preventDefault(); seleccionarOperador("÷"); return; }
    if (e.key === "Enter" || e.key === "=") { e.preventDefault(); igual(); return; }
    if (e.key === "Escape") { e.preventDefault(); limpiar(); return; }
    if (e.key === "Backspace") { e.preventDefault(); borrarUltimo(); return; }
  };

  const botones: { label: string; onClick: () => void; clase?: string }[] = [
    { label: "C", onClick: limpiar, clase: "text-red-500" },
    { label: "÷", onClick: () => seleccionarOperador("÷"), clase: "text-[#2563EB]" },
    { label: "×", onClick: () => seleccionarOperador("×"), clase: "text-[#2563EB]" },
    { label: "-", onClick: () => seleccionarOperador("-"), clase: "text-[#2563EB]" },
    { label: "7", onClick: () => inputDigito("7") },
    { label: "8", onClick: () => inputDigito("8") },
    { label: "9", onClick: () => inputDigito("9") },
    { label: "+", onClick: () => seleccionarOperador("+"), clase: "text-[#2563EB] row-span-2" },
    { label: "4", onClick: () => inputDigito("4") },
    { label: "5", onClick: () => inputDigito("5") },
    { label: "6", onClick: () => inputDigito("6") },
    { label: "1", onClick: () => inputDigito("1") },
    { label: "2", onClick: () => inputDigito("2") },
    { label: "3", onClick: () => inputDigito("3") },
    { label: "=", onClick: igual, clase: "bg-[#2563EB] text-white row-span-2" },
    { label: "0", onClick: () => inputDigito("0"), clase: "col-span-2" },
    { label: ",", onClick: inputDecimal },
  ];

  return (
    <div ref={contenedorRef} tabIndex={0} onKeyDown={manejarTeclado} className="outline-none">
      <div className="bg-slate-50 rounded-[10px] px-4 py-4 mb-3 text-right">
        <span className="text-2xl font-bold text-[#1A3A5C] tabular-nums break-all">
          {display}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {botones.map((b) => (
          <button
            key={b.label}
            onClick={b.onClick}
            className={cn(
              "py-3 rounded-[10px] border border-slate-200 text-sm font-semibold hover:bg-slate-50 transition-colors",
              b.clase
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Superficie ──────────────────────────────────────────── */
function CalculadoraSuperficie() {
  const [largo, setLargo] = useState("");
  const [ancho, setAncho] = useState("");
  const [huecos, setHuecos] = useState("");

  const largoNum  = parseFloat(largo) || 0;
  const anchoNum  = parseFloat(ancho) || 0;
  const huecosNum = parseFloat(huecos) || 0;
  const total = Math.max(0, largoNum * anchoNum - huecosNum);

  return (
    <div className="space-y-3">
      <CampoNumerico label="Largo (m)" value={largo} onChange={setLargo} />
      <CampoNumerico label="Ancho (m)" value={ancho} onChange={setAncho} />
      <CampoNumerico label="Descuento de huecos (m², opcional)" value={huecos} onChange={setHuecos} />
      <div className="bg-blue-50 rounded-[10px] px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[#1A3A5C]">Superficie</span>
        <span className="text-lg font-bold text-[#2563EB] tabular-nums">{fmtNum(total)} m²</span>
      </div>
    </div>
  );
}

/* ─── Volumen ─────────────────────────────────────────────── */
function CalculadoraVolumen() {
  const [largo, setLargo] = useState("");
  const [ancho, setAncho] = useState("");
  const [alto, setAlto] = useState("");

  const total = (parseFloat(largo) || 0) * (parseFloat(ancho) || 0) * (parseFloat(alto) || 0);

  return (
    <div className="space-y-3">
      <CampoNumerico label="Largo (m)" value={largo} onChange={setLargo} />
      <CampoNumerico label="Ancho (m)" value={ancho} onChange={setAncho} />
      <CampoNumerico label="Alto (m)" value={alto} onChange={setAlto} />
      <div className="bg-blue-50 rounded-[10px] px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[#1A3A5C]">Volumen</span>
        <span className="text-lg font-bold text-[#2563EB] tabular-nums">{fmtNum(total)} m³</span>
      </div>
    </div>
  );
}

/* ─── Mezclas ─────────────────────────────────────────────── */
// Fila de resultado (cantidad de un componente) — mismo estilo visual
// para mortero y hormigón, reusado en todos los casos.
function FilaComponente({ nombre, kg, m3, bolsas }: { nombre: string; kg: number; m3?: number; bolsas?: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-[#1A3A5C]">{nombre}</span>
      <span className="text-sm font-bold text-[#2563EB] tabular-nums">
        {fmtNum(kg, 0)} kg{bolsas != null ? ` (${fmtNum(bolsas, 1)} bolsas de 25kg)` : ""}
        {m3 != null ? ` (~${fmtNum(m3)} m³)` : ""}
      </span>
    </div>
  );
}

// Dosificación cemento:árido(s) → kg/m³ de cada componente, a partir de
// un volumen ya compactado (multiplica por FACTOR_ESPONJAMIENTO acá
// adentro) — mismo cálculo que usaban mortero y hormigón antes de
// separarse, ahora compartido por ambos lados.
function calcularDosificacion(volumenCompactado: number, partes: number[]) {
  const totalPartes = partes.reduce((s, p) => s + p, 0);
  const volumenAridos = volumenCompactado * FACTOR_ESPONJAMIENTO;
  return partes.map((p) => {
    const vol = (volumenAridos * p) / totalPartes;
    return vol;
  });
}

function SelectorTipo<T extends string>({
  opciones,
  valor,
  onChange,
}: {
  opciones: readonly { id: T; label: string }[];
  valor: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {opciones.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "py-2 px-2 rounded-[8px] border text-xs font-medium transition-all text-center leading-tight",
            valor === o.id
              ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
              : "border-slate-200 text-slate-500 hover:border-slate-300"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Categoria = "mortero" | "hormigon";
type TipoMortero = (typeof MORTEROS)[number]["id"];
type TipoHormigon = (typeof HORMIGONES)[number]["id"];

function CalculadoraMezclas() {
  const [categoria, setCategoria] = useState<Categoria>("hormigon");
  const [tipoMortero, setTipoMortero] = useState<TipoMortero>(MORTEROS[0].id);
  const [tipoHormigon, setTipoHormigon] = useState<TipoHormigon>(HORMIGONES[1].id);
  const [volumen, setVolumen] = useState("");
  const [notasCemento, setNotasCemento] = useState("");

  const volumenNum = parseFloat(volumen) || 0;

  return (
    <div className="space-y-3">
      {/* Toggle Mortero / Hormigón */}
      <div className="grid grid-cols-2 gap-2">
        {(["mortero", "hormigon"] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategoria(c)}
            className={cn(
              "py-2 rounded-[8px] border text-sm font-semibold transition-all text-center",
              categoria === c
                ? "border-[#2563EB] bg-[#2563EB] text-white"
                : "border-slate-200 text-slate-500 hover:border-slate-300"
            )}
          >
            {c === "mortero" ? "Mortero" : "Hormigón"}
          </button>
        ))}
      </div>

      {categoria === "mortero" ? (
        <>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-2">Tipo de mortero</label>
            <SelectorTipo opciones={MORTEROS} valor={tipoMortero} onChange={setTipoMortero} />
          </div>

          {tipoMortero === "premezcla" ? (
            <MorteroPremezcla
              volumen={volumen}
              setVolumen={setVolumen}
              notasCemento={notasCemento}
              setNotasCemento={setNotasCemento}
            />
          ) : (
            <MorteroProporcion
              volumen={volumen}
              setVolumen={setVolumen}
              volumenNum={volumenNum}
              tipo={MORTEROS.find((m): m is typeof MORTEROS[number] & { cemento: number; arena: number } => m.id === tipoMortero && "cemento" in m)!}
            />
          )}
        </>
      ) : (
        <>
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-2">Tipo de hormigón</label>
            <SelectorTipo opciones={HORMIGONES} valor={tipoHormigon} onChange={setTipoHormigon} />
          </div>

          {tipoHormigon === "ciclopeo" ? (
            <HormigonCiclopeo volumen={volumen} setVolumen={setVolumen} volumenNum={volumenNum} />
          ) : (
            <HormigonProporcion
              volumen={volumen}
              setVolumen={setVolumen}
              volumenNum={volumenNum}
              tipo={HORMIGONES.find((h) => h.id === tipoHormigon) as { cemento: number; arena: number; pedregullo: number }}
            />
          )}
        </>
      )}
    </div>
  );
}

// Mortero de proporción (asiento, revoque grueso, revoque fino) — solo
// cemento:arena, sin pedregullo. Mismo cálculo que hormigón pero con 2
// componentes en vez de 3.
function MorteroProporcion({
  volumen, setVolumen, volumenNum, tipo,
}: {
  volumen: string; setVolumen: (v: string) => void; volumenNum: number;
  tipo: { cemento: number; arena: number };
}) {
  const [volCemento, volArena] = calcularDosificacion(volumenNum, [tipo.cemento, tipo.arena]);
  const kgCemento = volCemento * DENSIDAD_CEMENTO;
  const kgArena = volArena * DENSIDAD_ARIDO;
  const bolsasCemento = kgCemento / 25;

  return (
    <>
      <CampoNumerico label="Volumen de mortero (m³)" value={volumen} onChange={setVolumen} />
      <div className="bg-blue-50 rounded-[10px] px-4 py-3 space-y-2">
        <FilaComponente nombre="Cemento" kg={kgCemento} bolsas={bolsasCemento} />
        <FilaComponente nombre="Arena" kg={kgArena} m3={volArena} />
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        * Valores estimativos según dosificación volumétrica con un coeficiente de esponjamiento de áridos de {FACTOR_ESPONJAMIENTO}.
      </p>
    </>
  );
}

// Mortero común premezclado — no dosifica componentes crudos, calcula
// directo cuántas bolsas de producto terminado hacen falta según
// RENDIMIENTO_BOLSA_MEZCLA (ver comentario en la constante).
function MorteroPremezcla({
  volumen, setVolumen, notasCemento, setNotasCemento,
}: {
  volumen: string; setVolumen: (v: string) => void;
  notasCemento: string; setNotasCemento: (v: string) => void;
}) {
  const volumenNum = parseFloat(volumen) || 0;
  const bolsas = Math.ceil(volumenNum / RENDIMIENTO_BOLSA_MEZCLA);

  return (
    <>
      <CampoNumerico label="Volumen a cubrir (m³)" value={volumen} onChange={setVolumen} />
      <div className="bg-blue-50 rounded-[10px] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#1A3A5C]">Bolsas de Mezcla</span>
          <span className="text-sm font-bold text-[#2563EB] tabular-nums">
            {volumenNum > 0 ? bolsas : 0} bolsas de 25kg
          </span>
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-text-primary mb-1.5">
          Notas — cemento de refuerzo (opcional)
        </label>
        <textarea
          value={notasCemento}
          onChange={(e) => setNotasCemento(e.target.value)}
          placeholder="Ej: agregar 1 bolsa de cemento cada 10 bolsas de mezcla"
          rows={2}
          className="w-full px-3 py-2 rounded-[8px] border border-slate-300 bg-bg-base text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all resize-y"
        />
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        * Rendimiento estimativo de {RENDIMIENTO_BOLSA_MEZCLA} m³ por bolsa de 25kg — ajustá el resultado si el
        rendimiento real difiere según marca o proveedor.
      </p>
    </>
  );
}

// Hormigón de proporción (estructural, uso general) — cemento:arena:
// pedregullo, mismo cálculo de siempre.
function HormigonProporcion({
  volumen, setVolumen, volumenNum, tipo,
}: {
  volumen: string; setVolumen: (v: string) => void; volumenNum: number;
  tipo: { cemento: number; arena: number; pedregullo: number };
}) {
  const [volCemento, volArena, volPedregullo] = calcularDosificacion(volumenNum, [tipo.cemento, tipo.arena, tipo.pedregullo]);
  const kgCemento = volCemento * DENSIDAD_CEMENTO;
  const kgArena = volArena * DENSIDAD_ARIDO;
  const kgPedregullo = volPedregullo * DENSIDAD_ARIDO;
  const bolsasCemento = kgCemento / 25;

  return (
    <>
      <CampoNumerico label="Volumen de hormigón (m³)" value={volumen} onChange={setVolumen} />
      <div className="bg-blue-50 rounded-[10px] px-4 py-3 space-y-2">
        <FilaComponente nombre="Cemento" kg={kgCemento} bolsas={bolsasCemento} />
        <FilaComponente nombre="Arena" kg={kgArena} m3={volArena} />
        <FilaComponente nombre="Pedregullo" kg={kgPedregullo} m3={volPedregullo} />
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        * Valores estimativos según dosificación volumétrica con un coeficiente de esponjamiento de áridos de {FACTOR_ESPONJAMIENTO}.
      </p>
    </>
  );
}

// Hormigón Ciclópeo — 2 etapas: hormigón 1:2:4 normal sobre el 60% del
// volumen total + piedra partida (15-30cm) desplazando el 40% restante,
// agregada en volumen directo (no se dosifica por peso como el resto).
function HormigonCiclopeo({
  volumen, setVolumen, volumenNum,
}: {
  volumen: string; setVolumen: (v: string) => void; volumenNum: number;
}) {
  const volumenHormigon = volumenNum * PROPORCION_HORMIGON_CICLOPEO;
  const volumenPiedraPartida = volumenNum * PROPORCION_PIEDRA_PARTIDA_CICLOPEO;

  const usoGeneral = HORMIGONES.find((h) => h.id === "uso-general") as { cemento: number; arena: number; pedregullo: number };
  const [volCemento, volArena, volPedregullo] = calcularDosificacion(volumenHormigon, [usoGeneral.cemento, usoGeneral.arena, usoGeneral.pedregullo]);
  const kgCemento = volCemento * DENSIDAD_CEMENTO;
  const kgArena = volArena * DENSIDAD_ARIDO;
  const kgPedregullo = volPedregullo * DENSIDAD_ARIDO;
  const bolsasCemento = kgCemento / 25;

  return (
    <>
      <CampoNumerico label="Volumen total (m³)" value={volumen} onChange={setVolumen} />
      <div className="bg-blue-50 rounded-[10px] px-4 py-3 space-y-2">
        <FilaComponente nombre="Cemento" kg={kgCemento} bolsas={bolsasCemento} />
        <FilaComponente nombre="Arena" kg={kgArena} m3={volArena} />
        <FilaComponente nombre="Pedregullo" kg={kgPedregullo} m3={volPedregullo} />
      </div>
      <div className="bg-amber-50 rounded-[10px] px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#1A3A5C]">Piedra partida</span>
          <span className="text-sm font-bold text-amber-700 tabular-nums">
            {fmtNum(volumenPiedraPartida)} m³
          </span>
        </div>
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        * Hormigón 1:2:4 sobre el {fmtNum(PROPORCION_HORMIGON_CICLOPEO * 100, 0)}% del volumen total + piedra
        partida (15-30cm) sobre el {fmtNum(PROPORCION_PIEDRA_PARTIDA_CICLOPEO * 100, 0)}% restante
        (referencia CYPE Uruguay). Coeficiente de esponjamiento de áridos: {FACTOR_ESPONJAMIENTO}.
      </p>
    </>
  );
}

/* ─── Componentes auxiliares ──────────────────────────────── */
function CampoNumerico({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-primary mb-1.5">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={0}
        step={0.01}
        placeholder="0"
        className="w-full px-3 py-2.5 rounded-[8px] border border-slate-300 bg-bg-base text-sm font-medium text-text-primary placeholder:text-text-muted focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-blue-100 transition-all"
      />
    </div>
  );
}
