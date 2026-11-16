export function Equalizer({ className = "" }: { className?: string }) {
  return (
    <span className={`flex h-3 items-end gap-[2px] ${className}`} aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="eq-bar w-[3px] rounded-full bg-acid" style={{ animationDelay: `${i * -0.23}s` }} />
      ))}
    </span>
  );
}
