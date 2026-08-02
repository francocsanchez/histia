"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth/client";
import { SessionUser } from "@/types/domain";
import { can } from "@/lib/permissions";

const primaryLinks = [
  { href: "/inicio", label: "Inicio", resource: "dashboard" as const },
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
  { href: "/usuarios", label: "Usuarios", resource: "usuarios" as const },
];

export function AppShell({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const visiblePrimaryLinks = primaryLinks.filter((link) =>
    can(user, link.resource, "read"),
  );
  const visibleSettingsLinks = settingsLinks.filter((link) =>
    can(user, link.resource, "read"),
  );
  const settingsOpen = useMemo(
    () => visibleSettingsLinks.some((link) => pathname === link.href),
    [pathname, visibleSettingsLinks],
  );

  return (
    <div className="min-h-screen bg-muted/35">
      <div className="grid min-h-screen md:grid-cols-[260px_1fr]">
        <aside className="border-r border-border bg-sidebar px-5 py-8">
          <div className="border-b border-border pb-6">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Histia
            </p>
            <h1 className="mt-3 text-2xl font-semibold">Administracion dental</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {user.nombre} {user.apellido}
            </p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          <nav className="mt-6 space-y-2">
            {visiblePrimaryLinks.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "block border px-3 py-3 text-sm transition",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-transparent hover:border-border hover:bg-accent",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}

            {visibleSettingsLinks.length > 0 ? (
              <details
                open={settingsOpen}
                className="group border border-transparent open:border-border open:bg-card"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-3 text-sm transition hover:bg-accent">
                  <span>Configuracion</span>
                  <ChevronDown className="size-4 transition group-open:rotate-180" />
                </summary>

                <div className="space-y-1 border-t border-border px-2 py-2">
                  {visibleSettingsLinks.map((link) => {
                    const active = pathname === link.href;

                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "block border px-3 py-2 text-sm transition",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-transparent hover:border-border hover:bg-accent",
                        )}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
              </details>
            ) : null}
          </nav>

          <div className="mt-8">
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-between"
              onClick={async () => {
                await authClient.signOut();
                router.push("/login");
                router.refresh();
              }}
            >
              Cerrar sesion
              <LogOut className="size-4" />
            </Button>
          </div>
        </aside>

        <main className="min-w-0 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
