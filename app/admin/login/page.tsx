import { redirect } from "next/navigation";
import { peekSession } from "@/lib/auth";
import { storeName, storefrontUrl } from "@/lib/format";
import LoginForm from "@/components/admin/LoginForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Masuk" };

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await peekSession();
  if (session) redirect("/admin");

  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/admin") ? next : "/admin";

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-900 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-lg font-extrabold tracking-tight text-white">RIZQY UTAMA</p>
          <p className="text-[11px] font-bold uppercase tracking-widest text-brand-400">
            Electric · Panel Admin
          </p>
        </div>

        <div className="rounded-lg border border-navy-700 bg-white p-6 shadow-xl sm:p-7">
          <h1 className="text-lg font-bold text-navy-900">Masuk ke Panel</h1>
          <p className="mb-6 mt-1 text-sm text-gray-500">
            Gunakan akun admin untuk mengelola produk dan kategori.
          </p>

          <LoginForm nextPath={nextPath} />
        </div>

        <a
          href={storefrontUrl()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 block text-center text-sm text-navy-200 transition hover:text-brand-400"
        >
          ← Kembali ke {storeName()}
        </a>
      </div>
    </div>
  );
}
