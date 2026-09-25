"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { storefrontUrl } from "@/lib/format";

type Props = {
  user: { name: string; email: string };
};

const NAV = [
  {
    href: "/admin",
    label: "Dashboard",
    icon: "M3 12l9-8 9 8M5 10v10h14V10",
  },
  {
    href: "/admin/produk",
    label: "Produk",
    icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
  },
  {
    href: "/admin/kategori",
    label: "Kategori",
    icon: "M7 4h13v16H7zM7 4L4 7v13h3M10 9h7M10 13h7",
  },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname.startsWith(href);
}

export default function Sidebar({ user }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-brand-500 text-white"
                : "text-navy-100 hover:bg-navy-800 hover:text-white"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
              stroke="currentColor"
              className="h-5 w-5 shrink-0"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
            </svg>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const footer = (
    <>
      <a
        href={storefrontUrl()}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-navy-100 transition hover:bg-navy-800 hover:text-white"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
          stroke="currentColor"
          className="h-5 w-5 shrink-0"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
          />
        </svg>
        Lihat Toko
      </a>

      <form action={logoutAction}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-navy-100 transition hover:bg-navy-800 hover:text-white"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-5 w-5 shrink-0"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
            />
          </svg>
          Logout
        </button>
      </form>
    </>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-navy-800 bg-navy-900 px-4 py-3 lg:hidden">
        <p className="text-sm font-extrabold tracking-tight text-white">
          RIZQY UTAMA <span className="text-brand-500">ADMIN</span>
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Buka menu navigasi"
          className="grid h-9 w-9 place-items-center rounded-md border border-navy-700 text-navy-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
            className="h-5 w-5"
          >
            {open ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
            )}
          </svg>
        </button>
      </div>

      {open ? (
        <div className="sticky top-[57px] z-30 space-y-4 border-b border-navy-800 bg-navy-900 px-4 py-4 lg:hidden">
          {links}
          {footer}
        </div>
      ) : null}

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto bg-navy-900 px-4 py-5 lg:flex">
        <div>
          <Link href="/admin" className="mb-7 block px-3 leading-tight">
            <span className="block text-base font-extrabold tracking-tight text-white">
              RIZQY UTAMA
            </span>
            <span className="block text-[11px] font-bold uppercase tracking-widest text-brand-500">
              Electric · Admin
            </span>
          </Link>
          {links}
        </div>

        <div className="space-y-3">
          {footer}
          <div className="border-t border-navy-800 px-3 pt-3">
            <p className="truncate text-sm font-semibold text-white">{user.name}</p>
            <p className="truncate text-xs text-navy-300">{user.email}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
