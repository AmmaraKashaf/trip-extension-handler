import type { Metadata } from "next";

export const metadata: Metadata = { title: "How it works" };

// Mirrors TURNAROUND_BUFFER_HOURS and MAX_EXTENSION_DAYS in backend/app/config.py.
const RULES = [
  "A renter can extend an active trip by 1 to 14 whole days.",
  "The car needs a 3h turnaround buffer between a return and the next pickup.",
  "Only upcoming bookings on the same vehicle can block an extension. Cancelled and completed bookings are ignored.",
  "Price is the approved days times the vehicle's daily rate.",
];

const DECISIONS = [
  { name: "Accept", className: "bg-green-100 text-green-800",
    text: "All requested days fit before the next pickup, buffer included. Returning exactly at the buffer boundary counts." },
  { name: "Counter-offer", className: "bg-amber-100 text-amber-800",
    text: "Not all the days fit, but at least one whole day does. We offer the days that fit." },
  { name: "Decline", className: "bg-red-100 text-red-800",
    text: "Not even one whole day fits before the buffer." },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-8 p-6">
      <h1 className="text-2xl font-bold">How it works</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Rules</h2>
        <ul className="list-disc space-y-1 pl-5">
          {RULES.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Decisions</h2>
        {DECISIONS.map(({ name, className, text }) => (
          <div key={name} className="rounded-md border border-zinc-200 bg-white p-3">
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${className}`}>{name}</span>
            <p className="mt-1 text-sm text-zinc-700">{text}</p>
          </div>
        ))}
        <p className="text-sm text-zinc-600">
          Confirming re-checks availability first, and only a clean accept is written. For a
          counter-offer, you confirm the offered days.
        </p>
      </section>
    </main>
  );
}
