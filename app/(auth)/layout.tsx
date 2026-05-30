export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,hsl(var(--muted))_0%,transparent_70%)]"
      />
      <div className="relative w-full max-w-sm animate-fade-up">{children}</div>
    </div>
  );
}
