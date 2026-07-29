/* eslint-disable @next/next/no-img-element -- Figma exports must render at their exact intrinsic geometry. */

interface AgentMarkProps {
  className?: string;
  compact?: boolean;
}

export function AgentMark({ className = "", compact = false }: AgentMarkProps) {
  if (compact) {
    return <img aria-hidden="true" className={className} src="/figma/card-mark.svg" alt="" />;
  }

  return (
    <span aria-hidden="true" className={`relative inline-block ${className}`}>
      <img className="absolute inset-0 h-full w-full" src="/figma/mascot-motion-a.svg" alt="" />
      <img className="absolute left-1/2 top-1/2 h-[32.76%] w-[36.21%] -translate-x-1/2 -translate-y-1/2" src="/figma/mascot-face.svg" alt="" />
    </span>
  );
}
