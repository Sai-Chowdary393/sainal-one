"use client";

import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import ProtectedRoute from "../../components/ProtectedRoute";
import { supabase } from "../../lib/supabase";
import { getCurrentOrganization } from "../../lib/getOrganization";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [organization, setOrganization] = useState(null);

  useEffect(() => {
    fetchUserAndOrganization();
  }, []);

  async function fetchUserAndOrganization() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const org = await getCurrentOrganization();

    setUser(user);
    setOrganization(org);
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
              <h3>Workspace</h3>

              <p>
                <strong>Company:</strong>{" "}
                {organization?.company_name || "No organization found"}
              </p>

              <p>
                <strong>Plan:</strong>{" "}
                {organization?.subscription_plan || "-"}
              </p>

              <p>
                <strong>Status:</strong>{" "}
                {organization?.status || "-"}
              </p>

              <p>
                <strong>Organization ID:</strong>{" "}
                {organization?.id || "-"}
              </p>
            </div>
          </section>
        </main>
      </div>
    </ProtectedRoute>
  );
}
