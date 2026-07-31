"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import styles from "./layout.module.css";

export default function UserDropdown({
  userName,
  userEmail,
  onNavigate,
}) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  return (
    <div className={styles.userDropdown}>
      <div className={styles.userDropdownHeader}>
        <div className={styles.largeAvatar}>
          {getInitials(userName || userEmail)}
        </div>

        <div className={styles.userDropdownIdentity}>
          <strong>{userName || "SaiNal One User"}</strong>
          <span>{userEmail || "Signed-in account"}</span>
          <small>Owner</small>
        </div>
      </div>

      <div className={styles.userMenu}>
        <Link
          href="/profile"
          className={styles.userMenuItem}
          onClick={onNavigate}
        >
          <span>◎</span>
          My Profile
        </Link>

        <Link
          href="/settings?section=notifications"
          className={styles.userMenuItem}
          onClick={onNavigate}
        >
          <span>◌</span>
          Notifications
        </Link>

        <Link
          href="/settings?section=appearance"
          className={styles.userMenuItem}
          onClick={onNavigate}
        >
          <span>◐</span>
          Appearance
        </Link>

        <Link
          href="/settings?section=help"
          className={styles.userMenuItem}
          onClick={onNavigate}
        >
          <span>?</span>
          Help & Support
        </Link>
      </div>

      <div className={styles.userDropdownFooter}>
        <button
          type="button"
          className={styles.logoutButton}
          onClick={handleLogout}
        >
          <span>↪</span>
          Log out
        </button>
      </div>
    </div>
  );
}

function getInitials(value = "") {
  const cleanedValue = value.trim();

  if (!cleanedValue) {
    return "SN";
  }

  const parts = cleanedValue.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
