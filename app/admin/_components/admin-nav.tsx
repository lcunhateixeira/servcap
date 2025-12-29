"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Visão geral" },
  { href: "/admin/people", label: "Pessoas" },
  { href: "/admin/credentials", label: "Credenciais" },
  { href: "/admin/certifications", label: "Certificados" },
  { href: "/admin/cohorts", label: "Turmas" },
  // depois:
  // { href: "/admin/courses", label: "Cursos" },
  // { href: "/admin/churches", label: "Igrejas" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-2">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-2 rounded text-sm ${
              active ? "bg-zinc-100 font-semibold" : "hover:bg-zinc-50"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
