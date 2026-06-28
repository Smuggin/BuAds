/** Temporary stub shown for views not yet built. Removed as each phase lands. */
export function PlaceholderView({ title, phase }: { title: string; phase: string }) {
  return (
    <section className="rounded-card border border-border bg-card p-10 text-center shadow-card">
      <div className="text-section-title">{title}</div>
      <div className="mt-2 text-[12.5px] text-muted">
        จะสร้างใน {phase} · Built in {phase}
      </div>
    </section>
  );
}
