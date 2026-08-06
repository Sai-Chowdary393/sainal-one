"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

export const AccessContext =
  createContext(null);

export default function AccessProvider({
  children,
}) {
  const [employee, setEmployee] =
    useState(null);

  const [organization, setOrganization] =
    useState(null);

  const [roles, setRoles] =
    useState([]);

  const [permissions, setPermissions] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadAccess =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/access",
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          /*
           * Login and registration pages can render
           * without an authenticated employee.
           */
          if (
            response.status === 401 ||
            response.status === 403
          ) {
            setEmployee(null);
            setOrganization(null);
            setRoles([]);
            setPermissions([]);
            return;
          }

          throw new Error(
            data.error ||
              "Unable to load account access."
          );
        }

        setEmployee(
          data.employee || null
        );

        setOrganization(
          data.organization || null
        );

        setRoles(
          Array.isArray(data.roles)
            ? data.roles
            : []
        );

        setPermissions(
          Array.isArray(
            data.permissions
          )
            ? data.permissions
            : []
        );
      } catch (error) {
        console.error(
          "Access loading error:",
          error
        );

        setError(
          error.message ||
            "Unable to load account access."
        );

        setEmployee(null);
        setOrganization(null);
        setRoles([]);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadAccess();
  }, [loadAccess]);

  const permissionSet =
    useMemo(
      () =>
        new Set(
          permissions.map(
            (permission) =>
              typeof permission ===
              "string"
                ? permission
                : permission.permission_key
          )
        ),
      [permissions]
    );

  const roleCodeSet =
    useMemo(
      () =>
        new Set(
          roles.map(
            (role) => role.code
          )
        ),
      [roles]
    );

  function hasPermission(
    permissionKey
  ) {
    if (!permissionKey) {
      return true;
    }

    if (
      employee
        ?.is_organization_owner
    ) {
      return true;
    }

    return permissionSet.has(
      permissionKey
    );
  }

  function hasAnyPermission(
    permissionKeys = []
  ) {
    if (
      employee
        ?.is_organization_owner
    ) {
      return true;
    }

    return permissionKeys.some(
      (permissionKey) =>
        permissionSet.has(
          permissionKey
        )
    );
  }

  function hasAllPermissions(
    permissionKeys = []
  ) {
    if (
      employee
        ?.is_organization_owner
    ) {
      return true;
    }

    return permissionKeys.every(
      (permissionKey) =>
        permissionSet.has(
          permissionKey
        )
    );
  }

  function hasRole(roleCode) {
    if (!roleCode) {
      return true;
    }

    if (
      employee
        ?.is_organization_owner
    ) {
      return true;
    }

    return roleCodeSet.has(
      roleCode
    );
  }

  const value = useMemo(
    () => ({
      employee,
      organization,
      roles,
      permissions,

      loading,
      error,

      isAuthenticated:
        Boolean(employee),

      isOrganizationOwner:
        Boolean(
          employee
            ?.is_organization_owner
        ),

      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasRole,

      refreshAccess:
        loadAccess,
    }),
    [
      employee,
      organization,
      roles,
      permissions,
      loading,
      error,
      permissionSet,
      roleCodeSet,
      loadAccess,
    ]
  );

  return (
    <AccessContext.Provider
      value={value}
    >
      {children}
    </AccessContext.Provider>
  );
}
