import type { ReactNode } from "react";

export function Karte({ titel, norm, children }: { titel: string; norm?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <header>
        <h2 className="text-base font-semibold text-slate-900">{titel}</h2>
        {norm && <p className="text-xs text-slate-500">{norm}</p>}
      </header>
      {children}
    </section>
  );
}

const feldKlasse = "mt-1 min-h-11 w-full touch-manipulation rounded-xl border border-slate-300 bg-white px-3 text-base focus:border-slate-900 focus:outline-none";

export function Feld({ label, hilfe, ...props }: { label: string; hilfe?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input {...props} className={feldKlasse} />
      {hilfe && <span className="mt-0.5 block text-xs font-normal text-slate-500">{hilfe}</span>}
    </label>
  );
}

export function Auswahl({ label, children, ...props }: { label: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select {...props} className={feldKlasse}>
        {children}
      </select>
    </label>
  );
}

export function Daten({ label, hilfe, ...props }: { label: string; hilfe: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <textarea
        {...props}
        rows={props.rows ?? 6}
        spellCheck={false}
        className="mt-1 w-full touch-manipulation rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm focus:border-slate-900 focus:outline-none"
      />
      <span className="mt-0.5 block text-xs font-normal text-slate-500">{hilfe}</span>
    </label>
  );
}

export function Knopf({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...props} className="min-h-11 touch-manipulation rounded-xl bg-slate-900 px-5 text-sm font-medium text-white active:bg-slate-700 disabled:opacity-40">
      {children}
    </button>
  );
}

export function Fehler({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
      {text}
    </p>
  ) : null;
}

export function Hinweise({ liste }: { liste: string[] }) {
  return liste.length ? (
    <ul className="space-y-1 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {liste.map((h, i) => (
        <li key={i}>{h}</li>
      ))}
    </ul>
  ) : null;
}

export function Tabelle({ kopf, zeilen }: { kopf: string[]; zeilen: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            {kopf.map((k) => (
              <th key={k} className="px-3 py-2 font-medium whitespace-nowrap">
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {zeilen.map((z, i) => (
            <tr key={i}>
              {z.map((c, j) => (
                <td key={j} className="px-3 py-2 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const chf = (n: number | null | undefined) => (n == null ? "–" : n.toLocaleString("de-CH", { maximumFractionDigits: 2 }));
export const prozent = (n: number | null | undefined, stellen = 1) => (n == null ? "–" : `${n.toLocaleString("de-CH", { maximumFractionDigits: stellen })} %`);
