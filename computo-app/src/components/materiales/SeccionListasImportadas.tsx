"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Loader2, Trash2 } from "lucide-react";
import { fechaUruguay } from "@/lib/fechaUruguay";
import type { ImportacionListada, ResultadoEliminacion } from "@/lib/importacionesPrecios";
import { cn } from "@/lib/utils";

// Sección "Listas importadas" de /materiales: Administrador (catálogo
// global) y rol Empresa (solo las de su empresa — lo filtra el servidor).
// Eliminar es en dos pasos inline, sin modal: primero se simula para mostrar
// cuántos materiales se borran y cuántos quedan protegidos por estar en uso,
// y recién al confirmar se borra.

type EstadoFila =
  | { paso: "simulando" }
  | { paso: "confirmar"; simulacion: ResultadoEliminacion }
  | { paso: "eliminando"; simulacion: ResultadoEliminacion }
  | { paso: "error"; mensaje: string };

export default function SeccionListasImportadas({
  esSuperadmin,
  version,
  onEliminada,
}: {
  esSuperadmin: boolean;
  /** Cambia después de cada importación para volver a cargar la lista. */
  version: number;
  /** Después de borrar materiales, para recargar el catálogo. */
  onEliminada: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [listas, setListas] = useState<ImportacionListada[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [estados, setEstados] = useState<Record<string, EstadoFila>>({});
  const [resultado, setResultado] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setErrorCarga(false);
    fetch("/api/importaciones-precios")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data: ImportacionListada[]) => setListas(data))
      .catch(() => setErrorCarga(true));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar, version]);

  const setEstado = (id: string, estado: EstadoFila | null) =>
    setEstados((prev) => {
      const next = { ...prev };
      if (estado) next[id] = estado;
      else delete next[id];
      return next;
    });

  async function pedir(id: string, simular: boolean): Promise<ResultadoEliminacion> {
    const res = await fetch(`/api/importaciones-precios/${id}${simular ? "?simular=1" : ""}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || "No se pudo completar. Probá de nuevo.");
    return data;
  }

  async function simular(id: string) {
    setResultado(null);
    setEstado(id, { paso: "simulando" });
    try {
      setEstado(id, { paso: "confirmar", simulacion: await pedir(id, true) });
    } catch (e) {
      setEstado(id, { paso: "error", mensaje: (e as Error).message });
    }
  }

  async function eliminar(lista: ImportacionListada, simulacion: ResultadoEliminacion) {
    setEstado(lista.id, { paso: "eliminando", simulacion });
    try {
      const r = await pedir(lista.id, false);
      setEstado(lista.id, null);
      setResultado(
        r.borrados === 0 && r.protegidos === 0
          ? `${nombreLista(lista)}: se eliminó la lista; no tenía materiales propios.`
          : `${nombreLista(lista)}: se ${r.borrados === 1 ? "borró 1 material" : `borraron ${r.borrados} materiales`}.` +
          (r.protegidos > 0
            ? ` ${r.protegidos === 1 ? "Quedó 1 protegido" : `Quedaron ${r.protegidos} protegidos`} porque ${r.protegidos === 1 ? "lo usa" : "los usa"} algún APU; la lista sigue acá con ${r.protegidos === 1 ? "él" : "ellos"}.`
            : "")
      );
      cargar();
      if (r.borrados > 0) onEliminada();
    } catch (e) {
      setEstado(lista.id, { paso: "error", mensaje: (e as Error).message });
    }
  }

  const cantidad = listas?.length ?? 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200">
      <button
        onClick={() => setAbierta((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <h2 className="text-sm font-semibold text-[#1E293B]">
            Listas importadas{listas ? ` (${cantidad})` : ""}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {esSuperadmin
              ? "Las listas de precios importadas al catálogo de CÓMPUTO+."
              : "Las listas de precios que importó tu empresa."}
          </p>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-slate-400 flex-shrink-0 transition-transform", abierta && "rotate-180")} />
      </button>

      {abierta && (
        <div className="border-t border-slate-100 px-5 py-4">
          {resultado && (
            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {resultado}
            </p>
          )}

          {errorCarga ? (
            <p className="text-sm text-red-600">No se pudieron cargar las listas importadas. Recargá la página para intentar de nuevo.</p>
          ) : listas === null ? (
            <p className="text-sm text-slate-400">Cargando…</p>
          ) : listas.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no hay listas importadas.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {listas.map((lista) => {
                const estado = estados[lista.id];
                return (
                  <li key={lista.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">{nombreLista(lista)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {fechaUruguay(new Date(lista.fecha))}
                          {lista.creadoPor && <> · {lista.creadoPor}</>} ·{" "}
                          <span className="tabular-nums">
                            {lista.materiales} material{lista.materiales === 1 ? "" : "es"}{" "}
                            {soloEnUso(lista) ? "en uso" : lista.materiales === 1 ? "nuevo" : "nuevos"}
                          </span>
                        </p>
                      </div>
                      {lista.esOficial ? (
                        <span className="text-xs text-slate-400">Lista oficial — no se elimina</span>
                      ) : (
                        !estado && (
                          <button
                            onClick={() => simular(lista.id)}
                            className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Eliminar lista
                          </button>
                        )
                      )}
                      {estado?.paso === "simulando" && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </div>

                    {(estado?.paso === "confirmar" || estado?.paso === "eliminando") && (
                      <ConfirmacionEliminar
                        simulacion={estado.simulacion}
                        esSuperadmin={esSuperadmin}
                        eliminando={estado.paso === "eliminando"}
                        onConfirmar={() => eliminar(lista, estado.simulacion)}
                        onCancelar={() => setEstado(lista.id, null)}
                      />
                    )}
                    {estado?.paso === "error" && (
                      <p className="mt-2 text-sm text-red-600">
                        {estado.mensaje}{" "}
                        <button onClick={() => setEstado(lista.id, null)} className="font-medium underline">
                          Cerrar
                        </button>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 text-xs text-slate-400">
            Cada lista muestra los materiales que agregó. Los que ya existían y la lista solo actualizó no se borran al
            eliminarla. Las listas importadas antes de que existiera esta sección no aparecen acá.
          </p>
        </div>
      )}
    </div>
  );
}

// Todos los materiales que le quedan a la lista los usa algún APU: es lo que
// queda después de eliminarla con protegidos (o una lista cuyos materiales ya
// se usan todos). Se muestran como "en uso" en vez de "nuevos".
function soloEnUso(lista: ImportacionListada): boolean {
  return lista.materiales > 0 && lista.enUso === lista.materiales;
}

function nombreLista(lista: ImportacionListada): string {
  if (lista.esOficial) return lista.descripcion ?? "Lista Oficial MTOP";
  return lista.descripcion ? `${lista.proveedor} — ${lista.descripcion}` : (lista.proveedor ?? "Sin proveedor");
}

function ConfirmacionEliminar({
  simulacion,
  esSuperadmin,
  eliminando,
  onConfirmar,
  onCancelar,
}: {
  simulacion: ResultadoEliminacion;
  esSuperadmin: boolean;
  eliminando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const { borrados, protegidos } = simulacion;
  const nadaQueBorrar = borrados === 0;
  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
      {nadaQueBorrar ? (
        <p>
          {protegidos === 0
            ? "Esta lista no tiene materiales propios: se elimina solo el registro de la lista."
            : `No se borra ningún material: ${protegidos === 1 ? "el único que tiene lo usa" : `los ${protegidos} que tiene los usa`} algún APU.`}
        </p>
      ) : (
        <p>
          Se van a borrar <strong>{borrados}</strong> material{borrados === 1 ? "" : "es"} del catálogo.
          {protegidos > 0 && (
            <>
              {" "}
              {protegidos === 1 ? "1 queda protegido" : `${protegidos} quedan protegidos`} porque{" "}
              {protegidos === 1 ? "lo usa" : "los usa"} algún APU.
            </>
          )}
        </p>
      )}
      {esSuperadmin && !nadaQueBorrar && (
        <p className="mt-1 text-xs text-amber-800">
          El Catálogo de Rubros busca precios por descripción: si algún rubro tomaba el precio de uno de estos
          materiales, va a pasar a usar otro.
        </p>
      )}
      <div className="mt-2 flex items-center gap-3">
        {(!nadaQueBorrar || protegidos === 0) && (
          <button
            onClick={onConfirmar}
            disabled={eliminando}
            className="flex items-center gap-1.5 rounded-[8px] bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {eliminando && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {nadaQueBorrar ? "Eliminar lista" : "Confirmar y borrar"}
          </button>
        )}
        <button onClick={onCancelar} disabled={eliminando} className="text-xs font-medium text-slate-600 hover:text-slate-800">
          {nadaQueBorrar && protegidos > 0 ? "Cerrar" : "Cancelar"}
        </button>
      </div>
    </div>
  );
}
