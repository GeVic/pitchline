"use client";

const EXAMPLE_PITCHES: { label: string; pitch: string }[] = [
  {
    label: "Confident",
    pitch:
      "We sell premium dog food for senior dogs, targeting owners who care about joint health and longevity. Grain-free, vet-formulated, subscription-based.",
  },
  {
    label: "Niche / B2B",
    pitch:
      "B2B SaaS for dental practices. We automate their patient recall workflow.",
  },
  {
    label: "Vague",
    pitch: "We help people feel better.",
  },
];

type Props = {
  pitch: string;
  onPitchChange: (value: string) => void;
  loading: boolean;
  runId: string | null;
  onSubmit: (e: React.FormEvent) => void;
};

export function PitchForm({
  pitch,
  onPitchChange,
  loading,
  runId,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-4">
      <div className="relative">
        <textarea
          value={pitch}
          onChange={(e) => onPitchChange(e.target.value)}
          rows={4}
          placeholder="Describe your business in a sentence or two…"
          className="w-full resize-none rounded-2xl border border-[#2a2620] bg-[#16140f]/80 px-5 py-4 text-base text-[#ece8e0] placeholder:text-[#6c665d] shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur transition-colors focus:border-[#e8b97c]/50 focus:outline-none focus:ring-2 focus:ring-[#e8b97c]/20 disabled:opacity-60"
          disabled={loading}
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="text-xs text-[#6c665d]">try:</span>
        {EXAMPLE_PITCHES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            onClick={() => onPitchChange(ex.pitch)}
            disabled={loading}
            className="rounded-full border border-[#2a2620] bg-[#16140f]/60 px-3.5 py-1.5 text-xs text-[#a8a195] transition-all hover:border-[#3a352d] hover:bg-[#16140f] hover:text-[#ece8e0] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {ex.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4">
        <button
          type="submit"
          disabled={loading || pitch.trim().length < 3}
          className="rounded-full bg-[#e8b97c] px-7 py-3 text-sm font-medium text-[#1a1410] shadow-[0_8px_24px_rgba(232,185,124,0.18)] transition-all hover:bg-[#f0c690] hover:shadow-[0_8px_30px_rgba(232,185,124,0.28)] disabled:cursor-not-allowed disabled:bg-[#3a352d] disabled:text-[#6c665d] disabled:shadow-none"
        >
          {loading ? "Streaming…" : "Run pipeline →"}
        </button>
        {runId && (
          <span className="font-mono text-xs text-[#6c665d]">
            run · {runId.slice(0, 8)}
          </span>
        )}
      </div>
    </form>
  );
}
