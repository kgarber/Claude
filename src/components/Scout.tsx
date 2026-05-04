"use client";

import { useState } from "react";
import type { Guess, CompsResult } from "@/lib/types";

type GuessWithComps = Guess & { comps?: CompsResult; compsError?: string; compsLoading?: boolean };

export default function Scout() {
  const [preview, setPreview] = useState<string | null>(null);
  const [guesses, setGuesses] = useState<GuessWithComps[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);
    setGuesses([]);
    setPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/identify", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Identify failed");
      const initial: GuessWithComps[] = (json.guesses as Guess[]).map((g) => ({
        ...g,
        compsLoading: true,
      }));
      setGuesses(initial);
      initial.forEach((g, i) => {
        fetch(`/api/comps?q=${encodeURIComponent(g.search_query)}`)
          .then((r) => r.json())
          .then((data) => {
            setGuesses((prev) => {
              const next = [...prev];
              if (data.error) {
                next[i] = { ...next[i], compsError: data.error, compsLoading: false };
              } else {
                next[i] = { ...next[i], comps: data, compsLoading: false };
              }
              return next;
            });
          })
          .catch((e) => {
            setGuesses((prev) => {
              const next = [...prev];
              next[i] = { ...next[i], compsError: String(e), compsLoading: false };
              return next;
            });
          });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <label
        htmlFor="photo"
        className="flex h-48 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/50 text-zinc-400 transition hover:border-zinc-500"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="max-h-44 rounded-xl object-contain" />
        ) : (
          <span>Tap to take a photo or upload</span>
        )}
        <input
          id="photo"
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      {loading && <p className="text-sm text-zinc-400">Identifying...</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <ul className="space-y-3">
        {guesses.map((g, i) => (
          <li key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <h3 className="font-medium">{g.label}</h3>
                {(g.brand || g.model) && (
                  <p className="text-xs text-zinc-400">
                    {[g.brand, g.model].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {Math.round(g.confidence * 100)}%
              </span>
            </div>
            {g.notes && <p className="mt-1 text-xs text-zinc-500">{g.notes}</p>}
            <p className="mt-2 text-xs text-zinc-500">
              <span className="text-zinc-400">eBay search:</span>{" "}
              <a
                className="underline decoration-zinc-700 hover:decoration-zinc-400"
                href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(g.search_query)}&LH_Sold=1&LH_Complete=1`}
                target="_blank"
                rel="noreferrer"
              >
                {g.search_query}
              </a>
            </p>

            <CompsBlock g={g} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompsBlock({ g }: { g: GuessWithComps }) {
  if (g.compsLoading) return <p className="mt-3 text-xs text-zinc-500">Loading comps...</p>;
  if (g.compsError) return <p className="mt-3 text-xs text-red-400">Comps: {g.compsError}</p>;
  const c = g.comps;
  if (!c) return null;
  if (c.count === 0) return <p className="mt-3 text-xs text-zinc-500">No comps found.</p>;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-3 text-sm">
        <Stat label="median" value={fmtMoney(c.median, c.currency)} />
        <Stat label="p25" value={fmtMoney(c.p25, c.currency)} />
        <Stat label="p75" value={fmtMoney(c.p75, c.currency)} />
        <Stat label="n" value={String(c.count)} />
      </div>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {c.samples.map((s, i) => (
          <li key={i} className="overflow-hidden rounded-lg border border-zinc-800">
            <a href={s.url} target="_blank" rel="noreferrer" className="block">
              {s.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.image} alt="" className="h-24 w-full object-cover" />
              )}
              <div className="p-2">
                <p className="line-clamp-2 text-xs text-zinc-300">{s.title}</p>
                <p className="mt-1 text-sm font-medium">{fmtMoney(s.price, s.currency)}</p>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-zinc-800/60 px-2 py-1">
      <span className="text-xs text-zinc-500">{label} </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function fmtMoney(n: number | undefined, currency: string): string {
  if (n === undefined) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}
