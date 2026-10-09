import { verifySession } from "@/lib/auth";
import { aiDisabledReason } from "@/lib/ai/access";
import PageHeader from "@/components/admin/PageHeader";
import AiChat from "@/components/admin/ai/AiChat";

export const dynamic = "force-dynamic";

export const metadata = { title: "Asisten AI" };

export default async function AiPage() {
  const user = await verifySession();
  const denied = aiDisabledReason(user.email);

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Asisten Inventori AI"
        description="Perintah bebas untuk membaca sheet, cek stok, bikin laporan, dan menyiapkan produk."
      />

      {denied ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Fitur AI belum bisa dipakai.</p>
          <p className="mt-1">{denied}</p>
        </div>
      ) : (
        <AiChat userName={user.name} />
      )}
    </div>
  );
}