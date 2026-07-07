"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);


  async function handleLogin(e) {

    e.preventDefault();

    if (!email || !password) {
      alert("Please enter email and password.");
      return;
    }


    setLoading(true);


    try {

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });


      if (error) {
        alert(error.message);
        return;
      }


      window.location.href = "/dashboard";


    } catch (error) {

      console.error(error);
      alert("Login failed.");

    } finally {

      setLoading(false);

    }

  }



  return (

    <main className="authPage">

      <section className="authCard">

        <h1>Welcome Back</h1>

        <p>
          Login to SaiNal One
        </p>


        <form
          onSubmit={handleLogin}
          className="authForm"
        >


          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
          />


          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />



          <button
            className="primaryBtn"
            type="submit"
          >

            {
              loading
                ? "Logging in..."
                : "Login"
            }

          </button>


        </form>



        <p className="helperText">

          New to SaiNal One?{" "}

          <Link
            href="/register"
            className="leadLink"
          >

            Create Account

          </Link>

        </p>



      </section>


    </main>

  );

}
