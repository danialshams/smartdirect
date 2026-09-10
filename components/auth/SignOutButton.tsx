"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() =>
        signOut({
          callbackUrl: "/login",
        })
      }
      className="flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-sm text-slate-500 transition hover:bg-red-50 hover:text-red-600"
    >
      <LogOut size={18} strokeWidth={1.8} />

      <span>خروج از حساب</span>
    </button>
  );
}