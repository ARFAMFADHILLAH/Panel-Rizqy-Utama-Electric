import { verifySession } from "@/lib/auth";
import { isAiAllowed } from "@/lib/ai/access";
import Sidebar from "@/components/admin/Sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await verifySession();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        user={{ name: user.name, email: user.email }}
        aiEnabled={isAiAllowed(user.email)}
      />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
