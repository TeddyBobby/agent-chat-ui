interface AgentMarkProps {
  className?: string;
  compact?: boolean;
}

export function AgentMark({ className = "", compact = false }: AgentMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 72 72"
      fill="none"
    >
      <path
        d="M36 6c6.3 0 11.7 4.1 13.5 9.8 5.7-1.4 11.9 1 14.9 6.2 3.1 5.4 2.1 12-2 16.3 4.1 4.3 5.1 10.9 2 16.3-3 5.2-9.2 7.6-14.9 6.2C47.7 66.5 42.3 70 36 70s-11.7-3.5-13.5-9.2c-5.7 1.4-11.9-1-14.9-6.2-3.1-5.4-2.1-12 2-16.3-4.1-4.3-5.1-10.9-2-16.3 3-5.2 9.2-7.6 14.9-6.2C24.3 10.1 29.7 6 36 6Z"
        fill="#65D45E"
      />
      <path
        d="M24.5 30.5c0-4.7 3.8-8.5 8.5-8.5 2.2 0 4.2.8 5.7 2.2A8.47 8.47 0 0 1 53 30.5v3c0 4.7-3.8 8.5-8.5 8.5-2.2 0-4.2-.8-5.7-2.2A8.47 8.47 0 0 1 24.5 33.5v-3Z"
        fill="white"
      />
      <circle cx="32.5" cy="32" r={compact ? "2" : "2.4"} fill="#1E1E1E" />
      <circle cx="44.8" cy="32" r={compact ? "2" : "2.4"} fill="#1E1E1E" />
    </svg>
  );
}
