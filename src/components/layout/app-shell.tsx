"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { SessionUser } from "@/types/domain";

const primaryLinks = [
  { href: "/dashboard", label: "Dashboard", resource: "admin-dashboard" as const },
  { href: "/inicio", label: "Inicio", resource: "dashboard" as const },
  { href: "/atenciones", label: "Atenciones", resource: "atenciones" as const },
  { href: "/rx", label: "RX", resource: "rx" as const },
  { href: "/pacientes", label: "Pacientes", resource: "pacientes" as const },
];

const settingsLinks = [
  {
    href: "/obras-sociales",
    label: "Obras sociales",
    resource: "obras-sociales" as const,
  },
  {
    href: "/codigos-obras-sociales",
    label: "Codigos",
    resource: "codigos-obras-sociales" as const,
  },
  {
    href: "/tipos-movimientos",
    label: "Tipos de movimientos",
    resource: "tipos-movimientos" as const,
  },
  { href: "/usuarios", label: "Usuarios", resource: "usuarios" as const },
];

const financeLinks = [
  {
    href: "/liquidaciones",
    label: "Liquidaciones",
    resource: "liquidaciones" as const,
  },
  { href: "/pagos", label: "Pagos", resource: "pagos" as const },
  { href: "/movimientos", label: "Movimientos", resource: "movimientos" as const },
];

function NavDropdown({
  label,
  links,
  pathname,
  open,
  onToggle,
  onNavigate,
}: {
  label: string;
  links: Array<{ href: string; label: string }>;
  pathname: string;
  open: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const active = links.some((link) => pathname === link.href);

  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          "flex h-11 items-center gap-2 border px-4 text-sm transition",
          active
            ? "border-primary bg-primary text-primary-foreground"
            : "border-transparent bg-transparent hover:border-border hover:bg-accent",
        )}
        onClick={onToggle}
      >
        <span>{label}</span>
        <ChevronDown className={cn("size-4 transition", open ? "rotate-180" : "")} />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 min-w-56 border border-border bg-card p-2 shadow-sm">
          <div className="space-y-1">
            {links.map((link) => {
              const itemActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "block border px-3 py-2 text-sm transition",
                    itemActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent hover:border-border hover:bg-accent",
                  )}
                  onClick={onNavigate}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [openMenu, setOpenMenu] = useState<"settings" | "finance" | "account" | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const visiblePrimaryLinks = primaryLinks.filter((link) =>
    can(user, link.resource, "read"),
  );
  const visibleSettingsLinks = settingsLinks.filter((link) =>
    can(user, link.resource, "read"),
  );
  const visibleFinanceLinks = financeLinks.filter((link) =>
    can(user, link.resource, "read"),
  );

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!navRef.current) {
        return;
      }

      if (!navRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  return (
    <div className="min-h-screen bg-muted/35">
      <header className="border-b border-border bg-sidebar">
        <nav
          ref={navRef}
          className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/inicio"
              className="mr-2 px-1 text-xs uppercase tracking-[0.24em] text-muted-foreground"
              onClick={() => setOpenMenu(null)}
            >
              Histia
            </Link>
            {visiblePrimaryLinks.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "inline-flex h-11 items-center border px-4 text-sm transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent bg-transparent hover:border-border hover:bg-accent",
                  )}
                  onClick={() => setOpenMenu(null)}
                >
                  {link.label}
                </Link>
              );
            })}

            {visibleSettingsLinks.length > 0 ? (
              <NavDropdown
                label="Configuracion"
                links={visibleSettingsLinks}
                pathname={pathname}
                open={openMenu === "settings"}
                onToggle={() =>
                  setOpenMenu((current) => (current === "settings" ? null : "settings"))
                }
                onNavigate={() => setOpenMenu(null)}
              />
            ) : null}

            {visibleFinanceLinks.length > 0 ? (
              <NavDropdown
                label="Finanzas"
                links={visibleFinanceLinks}
                pathname={pathname}
                open={openMenu === "finance"}
                onToggle={() =>
                  setOpenMenu((current) => (current === "finance" ? null : "finance"))
                }
                onNavigate={() => setOpenMenu(null)}
              />
            ) : null}
          </div>

          <div className="relative">
            <Button
              type="button"
              variant="secondary"
              className="justify-center px-3"
              title={`${user.nombre} ${user.apellido}`}
              onClick={() =>
                setOpenMenu((current) => (current === "account" ? null : "account"))
              }
            >
              <User className="size-4" />
            </Button>

            {openMenu === "account" ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-64 border border-border bg-card p-2 shadow-sm">
                <div className="border-b border-border px-3 py-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">
                    {user.nombre} {user.apellido}
                  </p>
                  <p>{user.email}</p>
                </div>
                <div className="pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={async () => {
                      setOpenMenu(null);
                      await authClient.signOut();
                      router.push("/login");
                      router.refresh();
                    }}
                  >
                    Cerrar sesion
                    <LogOut className="size-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </nav>
      </header>

      <main className="min-w-0 p-4 md:p-8">{children}</main>
    </div>
  );
}
