import Scout from "@/components/Scout";

export default function Page() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Thrift Scout</h1>
        <p className="text-sm text-zinc-400">
          Snap an item. Get likely IDs and resale comps before you walk away.
        </p>
      </header>
      <Scout />
    </main>
  );
}
