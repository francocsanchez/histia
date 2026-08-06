"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  userCreateSchema,
  userPasswordSchema,
  userUpdateSchema,
} from "@/lib/validations/schemas";
import { UserDto, userRoleValues, UserRole } from "@/types/domain";

type CreateValues = {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  roles: UserRole[];
};

type UpdateValues = {
  nombre: string;
  apellido: string;
  email: string;
  roles: UserRole[];
  activo: boolean;
};

type PasswordValues = {
  password: string;
};

type ListPayload = {
  success: boolean;
  data: UserDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  error?: { message?: string };
};

const roleLabels: Record<UserRole, string> = {
  administrador: "Administrador",
  odontologo: "Odontologo",
  radiologo: "Radiologo",
};

export function UsuariosManager() {
  const [items, setItems] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [selected, setSelected] = useState<UserDto | null>(null);
  const [statusDialogItem, setStatusDialogItem] = useState<UserDto | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const createForm = useForm<CreateValues>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      password: "",
      roles: ["odontologo"],
    },
  });
  const updateForm = useForm<UpdateValues>({
    resolver: zodResolver(userUpdateSchema),
    defaultValues: {
      nombre: "",
      apellido: "",
      email: "",
      roles: ["odontologo"],
      activo: true,
    },
  });
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(userPasswordSchema),
    defaultValues: { password: "" },
  });

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        status,
      });
      if (search) params.set("search", search);
      if (role) params.set("role", role);

      const response = await fetch(`/api/usuarios?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as ListPayload;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || "No se pudo cargar el listado");
      }

      setItems(payload.data);
      setTotalPages(payload.pagination.totalPages);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  const loadFromEffect = useEffectEvent(async () => {
    await load();
  });

  const createRoles =
    useWatch({ control: createForm.control, name: "roles" }) ?? [];
  const updateRoles =
    useWatch({ control: updateForm.control, name: "roles" }) ?? [];
  const updateActivo =
    useWatch({ control: updateForm.control, name: "activo" }) ?? true;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadFromEffect();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [page, search, status, role]);

  const toggleRole = (
    currentValue: UserRole[],
    nextRole: UserRole,
    setValue: (roles: UserRole[]) => void,
  ) => {
    const next = currentValue.includes(nextRole)
      ? currentValue.filter((roleItem) => roleItem !== nextRole)
      : [...currentValue, nextRole];

    setValue(next);
  };

  const openCreate = () => {
    setSelected(null);
    createForm.reset({
      nombre: "",
      apellido: "",
      email: "",
      password: "",
      roles: ["odontologo"],
    });
    setDialogOpen(true);
  };

  const openEdit = (item: UserDto) => {
    setSelected(item);
    updateForm.reset({
      nombre: item.nombre,
      apellido: item.apellido,
      email: item.email,
      roles: item.roles,
      activo: item.activo,
    });
    setDialogOpen(true);
  };

  const submitCreate = createForm.handleSubmit(async (values) => {
    const response = await fetch("/api/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      createForm.setError("root", {
        message: payload.error?.message || "No se pudo crear el usuario",
      });
      return;
    }

    setDialogOpen(false);
    await load();
  });

  const submitUpdate = updateForm.handleSubmit(async (values) => {
    if (!selected) return;

    const response = await fetch(`/api/usuarios/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      updateForm.setError("root", {
        message: payload.error?.message || "No se pudo actualizar el usuario",
      });
      return;
    }

    setDialogOpen(false);
    await load();
  });

  const submitPassword = passwordForm.handleSubmit(async (values) => {
    if (!selected) return;

    const response = await fetch(`/api/usuarios/${selected.id}/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      passwordForm.setError("root", {
        message: payload.error?.message || "No se pudo cambiar la contrasena",
      });
      return;
    }

    setPasswordDialogOpen(false);
  });

  const toggleStatus = async () => {
    if (!statusDialogItem) {
      return;
    }

    setStatusSubmitting(true);

    try {
      const response = await fetch(`/api/usuarios/${statusDialogItem.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !statusDialogItem.activo }),
      });

      if (response.ok) {
        setStatusDialogItem(null);
        await load();
      }
    } finally {
      setStatusSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestiona accesos internos, roles y contrasenas."
        actionLabel="Nuevo usuario"
        onAction={openCreate}
      />

      <Card className="grid gap-3 p-4 md:grid-cols-[1fr_220px_220px]">
        <Input
          placeholder="Buscar por nombre, apellido o email"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <Select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </Select>
        <Select
          value={role}
          onChange={(event) => {
            setPage(1);
            setRole(event.target.value);
          }}
        >
          <option value="">Todos los roles</option>
          {userRoleValues.map((roleValue) => (
            <option key={roleValue} value={roleValue}>
              {roleLabels[roleValue]}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? <LoadingState /> : null}
      {!loading && error ? <ErrorState label={error} retry={load} /> : null}
      {!loading && !error && items.length === 0 ? (
        <EmptyState label="No hay usuarios para mostrar." />
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/70 text-left">
                <tr>
                  <th className="px-4 py-3">Usuario</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Roles</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Actualizacion</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">
                      {item.apellido}, {item.nombre}
                    </td>
                    <td className="px-4 py-3">{item.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {item.roles.map((roleItem) => (
                          <Badge key={roleItem}>{roleLabels[roleItem]}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={item.activo ? "success" : "muted"}>
                        {item.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>
                          Editar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSelected(item);
                            passwordForm.reset({ password: "" });
                            setPasswordDialogOpen(true);
                          }}
                        >
                          Contrasena
                        </Button>
                        <Button
                          variant={item.activo ? "destructive" : "secondary"}
                          size="sm"
                          onClick={() => setStatusDialogItem(item)}
                        >
                          {item.activo ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-xs text-muted-foreground">
              Pagina {page} de {totalPages}
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Anterior
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={selected ? "Editar usuario" : "Nuevo usuario"}
      >
        <form
          className="space-y-4"
          onSubmit={selected ? submitUpdate : submitCreate}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium">Nombre</label>
              <Input
                {...(selected
                  ? updateForm.register("nombre")
                  : createForm.register("nombre"))}
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">Apellido</label>
              <Input
                {...(selected
                  ? updateForm.register("apellido")
                  : createForm.register("apellido"))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium">Email</label>
              <Input
                {...(selected
                  ? updateForm.register("email")
                  : createForm.register("email"))}
              />
            </div>
            {!selected ? (
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium">Contrasena</label>
                <Input type="password" {...createForm.register("password")} />
              </div>
            ) : null}
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium">Roles</label>
            <div className="flex flex-wrap gap-2">
              {userRoleValues.map((roleValue) => {
                const currentRoles = selected ? updateRoles : createRoles;
                const active = currentRoles.includes(roleValue);

                return (
                  <Button
                    key={roleValue}
                    type="button"
                    variant={active ? "primary" : "secondary"}
                    size="sm"
                    onClick={() =>
                      toggleRole(
                        currentRoles,
                        roleValue,
                        (roles) =>
                          selected
                            ? updateForm.setValue("roles", roles)
                            : createForm.setValue("roles", roles),
                      )
                    }
                  >
                    {roleLabels[roleValue]}
                  </Button>
                );
              })}
            </div>
          </div>

          {selected ? (
                <div>
                  <label className="mb-2 block text-sm font-medium">Estado</label>
                  <Select
                    value={updateActivo ? "true" : "false"}
                    onChange={(event) =>
                      updateForm.setValue("activo", event.target.value === "true")
                    }
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </Select>
                </div>
              ) : null}

          {(selected ? updateForm.formState.errors.root : createForm.formState.errors.root) ? (
            <p className="text-sm text-destructive">
              {selected
                ? updateForm.formState.errors.root?.message
                : createForm.formState.errors.root?.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit">Guardar</Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={passwordDialogOpen}
        onClose={() => setPasswordDialogOpen(false)}
        title="Cambiar contrasena"
      >
        <form className="space-y-4" onSubmit={submitPassword}>
          <div>
            <label className="mb-2 block text-sm font-medium">Nueva contrasena</label>
            <Input type="password" {...passwordForm.register("password")} />
          </div>

          {passwordForm.formState.errors.root ? (
            <p className="text-sm text-destructive">
              {passwordForm.formState.errors.root.message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPasswordDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button type="submit">Actualizar</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={Boolean(statusDialogItem)}
        onClose={() => setStatusDialogItem(null)}
        onConfirm={() => void toggleStatus()}
        busy={statusSubmitting}
        title={statusDialogItem?.activo ? "Desactivar usuario" : "Activar usuario"}
        description={
          statusDialogItem?.activo
            ? "El usuario perdera acceso al sistema hasta que vuelva a activarse. Queres continuar?"
            : "El usuario recuperara acceso al sistema segun sus roles actuales. Queres continuar?"
        }
        confirmLabel={statusDialogItem?.activo ? "Desactivar" : "Activar"}
        confirmVariant={statusDialogItem?.activo ? "destructive" : "primary"}
      />
    </div>
  );
}
