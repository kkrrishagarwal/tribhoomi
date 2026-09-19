"use client";
import { useT } from "@/lib/i18n";
import { Fragment, useState } from "react";
import { api } from "@/lib/api";
import UlpinBadge from "@/components/UlpinBadge";

const SCHEME = [
  ["SS", "State code (Census of India)", "09 = Uttar Pradesh"],
  ["DDD", "District code", "141 = Gautam Buddh Nagar"],
  ["VVVV", "Village / Ward code", "0018"],
  ["PPPPP", "Parcel number", "00045"],
  ["Bnn", "Building — B00 = the parcel itself", "B01"],
  ["Fnn / Lnn", "Level — F00 whole building, F01 ground floor, F02 first floor…; L01 basement 1…", "F08"],
  ["Unn", "Unit — U00 = whole level", "U03"],
  ["L", "Layer — S surface · A above ground · G underground · R air-rights", "A"],
];

export default function UlpinPage() {
  const { t } = useT();
  const [input, setInput] = useState("09-141-0031-00045-B01-F08-U03-A");
  const [parsed, setParsed] = useState<any>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [gen, setGen] = useState({ state: 27, district: 519, village_ward: 3301, parcel: 118, building: 1, floors_above: 4, basements: 1, units_per_floor: 2 });
  const [tree, setTree] = useState<any>(null);

  async function parse() {
    setParseError(null);
    try { setParsed(await api.parse(input)); } catch (e: any) { setParsed(null); setParseError(e.message); }
  }
  async function generate() {
    setTree(await api.generate(gen));
  }

  return (
    <div className="mx-auto max-w-screen-xl space-y-6 p-4">
      <div>
        <h1 className="text-xl font-semibold">{t("h.engine")}</h1>
        <p className="text-sm text-slate-600">The 14-digit 2D ULPIN stays intact as the first four segments; three vertical segments and a layer letter are appended. Zero in any vertical segment means “the whole thing one level up”, so any unit ID truncates back to its parcel.</p>
      </div>

      <div className="card overflow-x-auto p-4">
        <div className="label mb-2">Encoding scheme</div>
        <UlpinBadge ulpin="SS-DDD-VVVV-PPPPP-Bnn-Fnn-Unn-L" size="lg" showLegend />
        <table className="mt-3 w-full text-sm">
          <tbody>
            {SCHEME.map(([seg, meaning, ex]) => (
              <tr key={seg} className="border-t border-slate-100">
                <td className="py-1.5 pr-4 font-mono">{seg}</td>
                <td className="py-1.5 pr-4 text-slate-700">{meaning}</td>
                <td className="py-1.5 font-mono text-slate-500">{ex}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <div className="label">Decode any ULPIN</div>
          <div className="mt-2 flex gap-2">
            <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm" />
            <button onClick={parse} className="btn-primary">Parse</button>
          </div>
          {parseError && <p className="mt-2 text-sm text-red-600">{parseError}</p>}
          {parsed && (
            <div className="mt-3 space-y-2 text-sm">
              <UlpinBadge ulpin={parsed.normalized} showLegend />
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {Object.entries(parsed.parts).map(([k, v]) => (
                  <Fragment key={k}><dt className="text-slate-500">{k}</dt><dd className="font-mono">{String(v)}</dd></Fragment>
                ))}
              </dl>
              <div className="label">Parent chain</div>
              <ol className="space-y-1 font-mono text-xs">
                {parsed.parent_chain.map((c: string) => <li key={c}>{c}</li>)}
              </ol>
              <div className="text-xs text-emerald-700">2D ULPIN recovered by truncation: <span className="font-mono">{parsed.ulpin_2d}</span></div>
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="label">Generate a building's IDs from scratch</div>
          <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
            {Object.entries(gen).map(([k, v]) => (
              <label key={k} className="flex flex-col">
                <span className="text-slate-500">{k.replace("_", " ")}</span>
                <input type="number" value={v} onChange={(e) => setGen({ ...gen, [k]: Number(e.target.value) })} className="rounded border border-slate-300 px-2 py-1 font-mono" />
              </label>
            ))}
          </div>
          <button onClick={generate} className="btn-accent mt-3">Generate</button>
          {tree && (
            <div className="mt-3 max-h-80 overflow-y-auto text-xs">
              <div className="mb-1 text-slate-600">{tree.ids_generated} IDs generated · building <span className="font-mono">{tree.building_ulpin}</span></div>
              {[...tree.floors].reverse().map((f: any) => (
                <div key={f.floor} className="border-t border-slate-100 py-1">
                  <div className="font-mono text-slate-800">{f.floor_ulpin}</div>
                  <div className="ml-4 font-mono text-slate-500">{f.units.map((u: any) => u.unit_ulpin).join("  ")}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
