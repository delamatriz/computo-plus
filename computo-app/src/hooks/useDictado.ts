import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Dictado por voz con la Web Speech API del navegador (Chrome de escritorio y
// Android, Edge, Safari): sin servicios externos ni costo. Cada frase
// reconocida se entrega con onTexto; el que llama decide cómo sumarla al
// campo. Se detiene solo al detectar silencio (o, en modo continuo, recién
// con detener()), o con detener()/alternar().
// Sin soporte (Firefox, por ejemplo) soportado queda en false y no hay que
// mostrar el botón.

// Tipos mínimos: lib.dom no trae SpeechRecognition en todas las versiones.
interface ResultadoReconocimiento {
  readonly isFinal: boolean;
  readonly 0: { readonly transcript: string };
}
interface EventoResultado {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [i: number]: ResultadoReconocimiento };
}
interface EventoError {
  readonly error: string;
}
interface Reconocimiento {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoResultado) => void) | null;
  onerror: ((e: EventoError) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type ConstructorReconocimiento = new () => Reconocimiento;

function constructorReconocimiento(): ConstructorReconocimiento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// El soporte no cambia durante la sesión: no hay nada a qué suscribirse.
const sinSuscripcion = () => () => {};

export function useDictado({ onTexto, lang = "es-UY" }: { onTexto: (texto: string) => void; lang?: string }) {
  // En el servidor (y en la hidratación) false; en el cliente, lo que tenga
  // el navegador. Así el primer render del cliente coincide con el del servidor.
  const soportado = useSyncExternalStore(
    sinSuscripcion,
    () => constructorReconocimiento() !== null,
    () => false
  );
  const [escuchando, setEscuchando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reconocimientoRef = useRef<Reconocimiento | null>(null);
  const onTextoRef = useRef(onTexto);
  useEffect(() => {
    onTextoRef.current = onTexto;
  }, [onTexto]);

  // Al desmontar, cortar el micrófono si quedó escuchando.
  useEffect(() => () => reconocimientoRef.current?.abort(), []);

  const detener = useCallback(() => {
    reconocimientoRef.current?.stop();
  }, []);

  // continuo: sigue escuchando aunque haya pausas, hasta detener() — para el
  // "mantener apretado" del celular. Sin continuo, se corta solo con el silencio.
  const iniciar = useCallback(({ continuo = false }: { continuo?: boolean } = {}) => {
    const Ctor = constructorReconocimiento();
    if (!Ctor) return;
    reconocimientoRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = continuo;
    rec.interimResults = false; // solo texto final: nada de borradores en el campo
    rec.onresult = (e) => {
      let texto = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) texto += e.results[i][0].transcript;
      }
      texto = texto.trim();
      if (texto) onTextoRef.current(texto);
    };
    rec.onerror = (e) => {
      // "no-speech" y "aborted" no son errores para el usuario: solo se corta.
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("Permití el acceso al micrófono en el navegador para dictar.");
      } else if (e.error === "audio-capture") {
        setError("No se encontró un micrófono.");
      } else if (e.error === "network") {
        setError("El dictado necesita conexión a internet.");
      }
    };
    rec.onend = () => {
      setEscuchando(false);
      if (reconocimientoRef.current === rec) reconocimientoRef.current = null;
    };
    reconocimientoRef.current = rec;
    setError(null);
    try {
      rec.start();
      setEscuchando(true);
    } catch {
      // start() tira si ya hay una sesión en curso; no cambia nada.
      setEscuchando(false);
    }
  }, [lang]);

  const alternar = useCallback(() => {
    if (escuchando) detener();
    else iniciar();
  }, [escuchando, detener, iniciar]);

  return { soportado, escuchando, error, alternar, iniciar, detener };
}
