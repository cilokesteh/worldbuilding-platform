import { Role } from "@prisma/client";
import { prisma } from "./prisma";

/** Urutan kekuatan role: makin besar makin kuat. */
export const ROLE_RANK: Record<Role, number> = {
  VIEWER: 1,
  REVIEWER: 2,
  CONTRIBUTOR: 3,
  EDITOR: 4,
  ADMIN: 5,
  OWNER: 6,
};

export const ROLES: Role[] = ["OWNER", "ADMIN", "EDITOR", "CONTRIBUTOR", "REVIEWER", "VIEWER"];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Owner",
  ADMIN: "Admin",
  EDITOR: "Editor",
  CONTRIBUTOR: "Kontributor",
  REVIEWER: "Reviewer",
  VIEWER: "Viewer",
};

export async function getMemberRole(workspaceId: string, userId: string): Promise<Role | null> {
  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { ownerId: true } });
  if (!ws) return null;
  if (ws.ownerId === userId) return "OWNER";
  const m = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });
  return m?.role ?? null;
}

export async function requireRole(workspaceId: string, userId: string, min: Role): Promise<Role> {
  const role = await getMemberRole(workspaceId, userId);
  if (!role || ROLE_RANK[role] < ROLE_RANK[min]) throw new Error("FORBIDDEN");
  return role;
}

/** World -> workspaceId, dipakai untuk cek akses lewat world. */
export async function getWorkspaceIdOfWorld(worldId: string): Promise<string | null> {
  const w = await prisma.world.findUnique({ where: { id: worldId }, select: { workspaceId: true } });
  return w?.workspaceId ?? null;
}

export async function canReadWorld(worldId: string, userId: string | null): Promise<boolean> {
  const w = await prisma.world.findUnique({
    where: { id: worldId },
    select: { isPublic: true, workspaceId: true },
  });
  if (!w) return false;
  if (w.isPublic) return true;
  if (!userId) return false;
  return (await getMemberRole(w.workspaceId, userId)) !== null;
}
