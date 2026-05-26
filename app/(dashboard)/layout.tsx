import { requireUser } from "@/lib/auth/get-user";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardNav email={user.email!} />
      <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
    </div>
  );
}
