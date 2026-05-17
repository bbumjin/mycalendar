export function ProviderBadge({ provider, size = 'sm' }: { provider: 'google' | 'microsoft' | null; size?: 'sm' | 'xs' }) {
  if (!provider) return null;
  const isGoogle = provider === 'google';
  const label = isGoogle ? 'Google' : 'Outlook';
  const color = isGoogle ? '#4285F4' : '#0078D4';
  if (size === 'xs') {
    return (
      <span
        className="inline-flex w-3 h-3 rounded-full shrink-0"
        style={{ backgroundColor: color }}
        title={label}
        aria-label={label}
      />
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}
