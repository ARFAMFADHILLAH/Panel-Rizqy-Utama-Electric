"use client";

import { useFormStatus } from "react-dom";

type Props = {
  message: string;
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
};

export default function ConfirmSubmit({
  message,
  children,
  pendingText = "Memproses…",
  className = "rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60",
}: Props) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? pendingText : children}
    </button>
  );
}
