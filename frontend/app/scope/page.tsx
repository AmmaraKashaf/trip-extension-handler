import type { Metadata } from "next";

export const metadata: Metadata = { title: "Scope" };

const LEFT_OUT = [
  { name: "Auth", why: "Out of scope for the feature. In production, operators would log in and see only their own fleet." },
  { name: "Real Turo calendar sync", why: "Availability comes only from this database. A real system would also pull in external bookings and blocks." },
  { name: "Payments", why: "The booking total is updated, but no money moves. That would need a payment provider and a failure path." },
  { name: "Renter notifications", why: "No email or SMS. The operator sees the reason text and passes it on." },
  { name: "Pricing engine", why: "Flat days × daily rate only: no weekend rates, discounts, taxes or deposits." },
];

export default function ScopePage() {
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Scope</h1>
        <p className="text-zinc-600">What was left out on purpose, and why.</p>
      </div>

      <ul className="space-y-3">
        {LEFT_OUT.map(({ name, why }) => (
          <li key={name} className="rounded-md border border-zinc-200 bg-white p-3">
            <p className="font-medium">{name}</p>
            <p className="text-sm text-zinc-700">{why}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
