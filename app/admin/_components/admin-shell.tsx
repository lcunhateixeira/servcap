"use client";

import { useState } from "react";
import AdminNav from "./admin-nav";
import LogoutButton from "./logout-button";

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside className="hidden md:block w-64 border-r bg-white">
        <div className="p-4 font-bold">ServCap • Admin</div>
        <AdminNav />
      </aside>

      {/* Mobile */}
      <div className="md:hidden">
        {open && (
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          className={`fixed top-0 left-0 h-full w-72 bg-white border-r z-50 transform transition-transform ${open ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="p-4 flex items-center justify-between border-b">
            <span className="font-bold">ServCap • Admin</span>
            <button className="border rounded px-2 py-1 text-sm" onClick={() => setOpen(false)}>
              Fechar
            </button>
          </div>
          <div className="p-2" onClick={() => setOpen(false)}>
            <AdminNav />
          </div>
        </aside>
      </div>

      {/* Conteúdo */}
      <div className="flex-1">
        {/* Topbar mobile */}
        <header className="md:hidden flex items-center justify-between border-b p-3 bg-white">
          <button className="border rounded px-3 py-2 text-sm" onClick={() => setOpen(true)}>
            Menu
          </button>
          <span className="font-semibold text-sm">Admin</span>
          <div className="w-16" />
        </header>

        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
