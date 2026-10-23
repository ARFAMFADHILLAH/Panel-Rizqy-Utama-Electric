"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { slugify } from "@/lib/slugify";
import type { ActionState } from "@/lib/types";
import SubmitButton from "@/components/admin/SubmitButton";

type CategoryValues = {
  id: number;
  name: string;
  slug: string;
};

type Props = {
  formAction: (state: ActionState, formData: FormData) => Promise<ActionState>;
  category?: CategoryValues;
  submitText?: string;
  cancelHref?: string;
};

export default function CategoryForm({
  formAction,
  category,
  submitText = "Tambah Kategori",
  cancelHref,
}: Props) {
  const [state, action] = useActionState<ActionState, FormData>(formAction, {});
  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));

  return (
    <form action={action} className="space-y-3">
      {category ? <input type="hidden" name="id" value={category.id} /> : null}

      {state.error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p
          role="status"
          className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700"
        >
          {state.message}
        </p>
      ) : null}

      <div>
        <label htmlFor="cat-name" className="mb-1.5 block text-sm font-medium text-navy-800">
          Nama <span className="text-red-500">*</span>
        </label>
        <input
          id="cat-name"
          name="name"
          required
          maxLength={255}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          placeholder="Kabel"
        />
      </div>

      <div>
        <label htmlFor="cat-slug" className="mb-1.5 block text-sm font-medium text-navy-800">
          Slug
        </label>
        <input
          id="cat-slug"
          name="slug"
          value={slug}
          onChange={(event) => {
            setSlugTouched(true);
            setSlug(event.target.value);
          }}
          className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          placeholder="otomatis dari nama"
        />
      </div>

      <SubmitButton
        pendingText="Menyimpan…"
        className="w-full rounded-md bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitText}
      </SubmitButton>

      {cancelHref ? (
        <Link
          href={cancelHref}
          className="block w-full rounded-md border border-gray-300 px-5 py-2.5 text-center text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          Batal
        </Link>
      ) : null}
    </form>
  );
}
