type Props = {
  questions: string[];
  confidence?: number | undefined;
};

export function ClarifyingBanner({ questions, confidence }: Props) {
  if (questions.length === 0) return null;
  return (
    <aside className="pl-fade-in mt-8 rounded-2xl border border-[#3a352d] bg-[#16140f]/80 px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-medium text-[#e8b97c]">Low-confidence pitch</div>
        {typeof confidence === "number" && (
          <span className="font-mono text-xs text-[#a8a195]">
            confidence · {confidence.toFixed(2)}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-[#a8a195]">
        The pipeline ran to completion, but the extract stage flagged the pitch as ambiguous. Answering these would improve the next run:
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#ece8e0]/85">
        {questions.map((q, i) => (
          <li key={i}>{q}</li>
        ))}
      </ul>
    </aside>
  );
}
