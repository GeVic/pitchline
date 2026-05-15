export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="pl-fade-in mt-8 rounded-2xl border border-red-900/50 bg-red-950/20 px-5 py-4 text-sm text-red-300">
      <div className="font-medium">Error</div>
      <div className="mt-1 text-red-200/80">{message}</div>
    </div>
  );
}
