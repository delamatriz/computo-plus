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

const DOSIFICACIONES = [
  { id: "1:2:3", label: "1:2:3 (estructural)", cemento: 1, arena: 2, piedra: 3 },
  { id: "1:2:4", label: "1:2:4 (uso general)",  cemento: 1, arena: 2, piedra: 4 },
  { id: "1:3:3", label: "1:3:3 (tabiques)",     cemento: 1, arena: 3, piedra: 3 },
  { id: "1:3:6", label: "1:3:6 (contrapisos)",  cemento: 1, arena: 3, piedra: 6 },
];

const DENSIDAD_CEMENTO = 1400; // kg/m³
const DENSIDAD_ARIDO   = 1500; // kg/m³
const FACTOR_ESPONJAMIENTO = 1.5; // m³ de áridos sueltos por m³ de hormigón compactado

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
function CalculadoraMezclas() {
  const [volumen, setVolumen] = useState("");
  const [dosificacion, setDosificacion] = useState(DOSIFICACIONES[1].id);

  const volumenNum = parseFloat(volumen) || 0;
  const dosi = DOSIFICACIONES.find((d) => d.id === dosificacion) ?? DOSIFICACIONES[1];
  const totalPartes = dosi.cemento + dosi.arena + dosi.piedra;

  const volumenAridos = volumenNum * FACTOR_ESPONJAMIENTO;
  const volCemento = (volumenAridos * dosi.cemento) / totalPartes;
  const volArena   = (volumenAridos * dosi.arena) / totalPartes;
  const volPiedra  = (volumenAridos * dosi.piedra) / totalPartes;

  const kgCemento = volCemento * DENSIDAD_CEMENTO;
  const kgArena   = volArena * DENSIDAD_ARIDO;
  const kgPiedra  = volPiedra * DENSIDAD_ARIDO;
  const bolsasCemento = kgCemento / 25;

  return (
    <div className="space-y-3">
      <CampoNumerico label="Volumen de hormigón (m³)" value={volumen} onChange={setVolumen} />

      <div>
        <label className="block text-xs font-semibold text-text-primary mb-2">Dosificación</label>
        <div className="grid grid-cols-2 gap-2">
          {DOSIFICACIONES.map((d) => (
            <button
              key={d.id}
              onClick={() => setDosificacion(d.id)}
              className={cn(
                "py-2 rounded-[8px] border text-xs font-medium transition-all text-center",
                dosificacion === d.id
                  ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-blue-50 rounded-[10px] px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#1A3A5C]">Cemento</span>
          <span className="text-sm font-bold text-[#2563EB] tabular-nums">
            {fmtNum(kgCemento, 0)} kg ({fmtNum(bolsasCemento, 1)} bolsas de 25kg)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#1A3A5C]">Arena</span>
          <span className="text-sm font-bold text-[#2563EB] tabular-nums">
            {fmtNum(kgArena, 0)} kg (~{fmtNum(volArena)} m³)
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#1A3A5C]">Piedra</span>
          <span className="text-sm font-bold text-[#2563EB] tabular-nums">
            {fmtNum(kgPiedra, 0)} kg (~{fmtNum(volPiedra)} m³)
          </span>
        </div>
      </div>
      <p className="text-[11px] text-text-muted leading-relaxed">
        * Valores estimativos según dosificación volumétrica con un coeficiente de esponjamiento de áridos de {FACTOR_ESPONJAMIENTO}.
      </p>
    </div>
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
