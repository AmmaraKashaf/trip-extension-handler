"use client";

import { useState } from "react";

import {
  type Booking, type Decision, type ExtensionDecision,
  confirmExtension, formatDateTime, formatMoney, quoteExtension,
} from "../lib/api";

const MAX_DAYS = 14; // mirrors MAX_EXTENSION_DAYS on the backend

const DECISION_STYLES: Record<Decision, { label: string; className: string }> = {
  accept: { label: "Accept", className: "bg-green-100 text-green-800" },
  counter_offer: { label: "Counter-offer", className: "bg-amber-100 text-amber-800" },
  decline: { label: "Decline", className: "bg-red-100 text-red-800" },
};

type Props = {
  booking: Booking;
  onConfirmed: () => void;
};

export default function ExtensionPanel({ booking, onConfirmed }: Props) {
  const [days, setDays] = useState(1);
  const [result, setResult] = useState<ExtensionDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(action: () => Promise<void>) {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const checkExtension = () =>
    run(async () => setResult(await quoteExtension(booking.id, days)));

  // For a counter-offer we confirm the approved days, so the backend only ever applies a clean accept.
  const confirm = (approvedDays: number) =>
    run(async () => {
      await confirmExtension(booking.id, approvedDays);
      setResult(null);
      onConfirmed();
    });

  return (
    <div className="mt-2 ml-2 space-y-2 border-l-2 border-blue-200 pl-3 text-sm">
      <div className="flex items-center gap-2">
        <label htmlFor={`days-${booking.id}`}>Extend by</label>
        <input
          id={`days-${booking.id}`}
          type="number"
          min={1}
          max={MAX_DAYS}
          value={days}
          onChange={(e) => {
            setDays(Number(e.target.value));
            setResult(null); // a quote is only valid for the days it was asked for
          }}
          className="w-16 rounded border border-zinc-300 px-2 py-1"
        />
        <span>day(s)</span>
        <button
          onClick={checkExtension}
          disabled={loading}
          className="rounded bg-zinc-900 px-3 py-1 text-white disabled:opacity-50"
        >
          {loading ? "Working…" : "Check extension"}
        </button>
      </div>

      {error && <p className="text-red-700">{error}</p>}

      {result && (
        <ResultBox result={result} loading={loading} onConfirm={() => confirm(result.approved_days)} />
      )}
    </div>
  );
}

type ResultBoxProps = {
  result: ExtensionDecision;
  loading: boolean;
  onConfirm: () => void;
};

function ResultBox({ result, loading, onConfirm }: ResultBoxProps) {
  const style = DECISION_STYLES[result.decision];
  const canConfirm = result.decision !== "decline";

  return (
    <div className="space-y-1 rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${style.className}`}>
        {style.label}
      </span>
      <p>{result.reason}</p>
      <p className="text-zinc-600">
        Approved days: {result.approved_days}
        {result.new_end_at && <> · New return: {formatDateTime(result.new_end_at)}</>}
        {" "}· Extra: {formatMoney(result.extra_amount)}
      </p>
      {canConfirm && (
        <button
          onClick={onConfirm}
          disabled={loading}
          className="rounded bg-green-700 px-3 py-1 text-white disabled:opacity-50"
        >
          Confirm {result.approved_days} day(s)
        </button>
      )}
    </div>
  );
}
