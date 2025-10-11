"use client";

import LoginForm from "./login-form";

export default function LoginScreen() {
  return (
    <section className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-black via-neutral-900 to-black">
      <div className="w-full max-w-md mx-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-8 shadow-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-semibold text-white">
            WhatsApp Odoo Connector
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Sign in with your Odoo credentials to start messaging.
          </p>
        </header>
        <LoginForm />
      </div>
    </section>
  );
}
