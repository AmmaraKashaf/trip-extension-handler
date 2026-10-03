"use client";

import { useCallback, useEffect, useState } from "react";

import VehicleCard from "./components/VehicleCard";
import { type Vehicle, getVehicles, resetDemo } from "./lib/api";

export default function Home() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // State is only set in promise callbacks, so this is safe to call from an effect.
  const loadVehicles = useCallback(
    () =>
      getVehicles()
        .then((list) => {
          setVehicles(list);
          setError(null);
        })
        .catch((err: Error) => setError(err.message))
        .finally(() => setLoading(false)),
    [],
  );

  async function handleReset() {
    setLoading(true);
    setError(null);
    try {
      await resetDemo();
      await loadVehicles();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fleet</h1>
        <button
          onClick={handleReset}
          disabled={loading}
          className="rounded border border-zinc-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Reset demo data
        </button>
      </header>

      {error && <p className="mb-4 rounded bg-red-50 p-3 text-red-700">{error}</p>}
      {loading && vehicles.length === 0 && <p className="text-zinc-500">Loading…</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {vehicles.map((vehicle) => (
          <VehicleCard key={vehicle.id} vehicle={vehicle} onExtended={loadVehicles} />
        ))}
      </div>
    </main>
  );
}
