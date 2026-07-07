"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();

    if (!fullName || !email || !password) {
      alert("Please enter name, email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        alert(error.message);
        return;
      }

      alert("Account created successfully. You can now login.");
      window.location.href = "/login";
    } catch (error) {
      console.error(error);
      alert("Error creating account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <section className="authCard">
        <h1>Create Account</h1>
        <p>Create your SaiNal One account.</p>

        <form onSubmit={handleRegister} className="authForm">
          <input
            placeholder="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />

          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="primaryBtn" type="submit">
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="helperText">
          Already have an account?{" "}
          <Link href="/login" className="leadLink">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
