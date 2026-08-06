"use client";

import useAccess from "../../hooks/useAccess";

export default function PermissionGuard({
  permission,
  anyPermissions = [],
  allPermissions = [],
  role,
  fallback = null,
  loadingFallback = null,
  children,
}) {
  const {
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasRole,
  } = useAccess();

  if (loading) {
    return loadingFallback;
  }

  let allowed = true;

  if (permission) {
    allowed =
      allowed &&
      hasPermission(permission);
  }

  if (
    Array.isArray(
      anyPermissions
    ) &&
    anyPermissions.length > 0
  ) {
    allowed =
      allowed &&
      hasAnyPermission(
        anyPermissions
      );
  }

  if (
    Array.isArray(
      allPermissions
    ) &&
    allPermissions.length > 0
  ) {
    allowed =
      allowed &&
      hasAllPermissions(
        allPermissions
      );
  }

  if (role) {
    allowed =
      allowed &&
      hasRole(role);
  }

  if (!allowed) {
    return fallback;
  }

  return children;
}
