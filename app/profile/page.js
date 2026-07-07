"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";
import { supabase } from "../../lib/supabase";

export default function ProfilePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUser(user);
  }

  return (
    <ProtectedRoute>
      <div className="appLayout">
        <Sidebar />

        <main className="mainContent">
          <div className="topBar">
            <div>
              <h1>Profile</h1>
              <p className="helperText">
                Manage your SaiNal One user account.
              </p>
            </div>
          </div>

          <section className="detailsGrid">
            <div className="panel">
              <h3>User Information</h3>

              <p>
                <strong>Name:</strong>{" "}
                {user?.user_metadata?.full_name || "Not provided"}
              </p>

              <p>
                <strong>Email:</strong> {user?.email || "-"}
              </p>

              <p>
                <strong>User ID:</strong> {user?.id || "-"}
              </p>

              <p>
                <strong>Role:</strong> Owner
              </p>
            </div>

            <div className="panel">
              <h3>Account Status</h3>
              <p>Authentication: Active</p>
              <p>Provider: Email Login</p>
              <p>Workspace: SaiNal One</p>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
