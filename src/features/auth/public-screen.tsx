import { Submit } from "./submit";
import Link from "next/link";
import * as a from "./actions";
import { Field, IdentityFields, PasswordFields } from "./fields";
import { TokenForm } from "./token";
import { configured } from "@/server/auth/session";
import { safeContext } from "./validation";
export type Query = Promise<Record<string, string | string[] | undefined>>;
export async function PublicScreen({
  mode,
  query,
}: {
  mode:
    | "login"
    | "register"
    | "verify-email"
    | "forgot-password"
    | "reset-password";
  query: Query;
}) {
  const q = await query;
  const ctx = safeContext(q.kind, q.value);
  const hidden = ctx && (
    <>
      <input type="hidden" name="kind" value={ctx.kind} />
      <input type="hidden" name="value" value={ctx.value} />
    </>
  );
  const signup = mode === "register";
  return (
    <>
      <h1>
        {
          {
            login: "Welcome back",
            register: "Create your AURA account",
            "verify-email": "Verify your email",
            "forgot-password": "Recover your account",
            "reset-password": "Set a new password",
          }[mode]
        }
      </h1>
      {!configured() && (
        <p role="status">
          Sign-in is currently unavailable. Please try again later.
        </p>
      )}
      {q.notice && q.notice !== "provider" && (
        <p role="status">
          {q.notice === "requested"
            ? "If your address is eligible, check your inbox."
            : q.notice === "changed"
              ? "Password updated. Sign in again."
              : q.notice === "rate"
                ? "Too many attempts. Please try again later."
                : "We couldn’t complete that request. Check your details and try again."}
        </p>
      )}
      {signup || mode === "login" ? (
        <>
          <form className="oauth-form" action={a.google}>
            {hidden}
            <Submit>Continue with Google</Submit>
          </form>
          <div className="email-divider">
            <span>or use email</span>
          </div>
          <form action={signup ? a.register : a.login}>
            {hidden}
            <Field name="email" type="email" label="Email address" />
            {signup ? (
              <>
                <IdentityFields />
                <PasswordFields />
              </>
            ) : (
              <Field name="password" type="password" label="Password" />
            )}
            <Submit>{signup ? "Create account" : "Log in"}</Submit>
          </form>
          <Link
            href={
              (signup ? "/login" : "/register") +
              (ctx
                ? "?" +
                  new URLSearchParams({ kind: ctx.kind, value: ctx.value })
                : "")
            }
          >
            {signup ? "Already have an account? Log in" : "Create an account"}
          </Link>{" "}
          · <Link href="/forgot-password">Forgot password?</Link>
        </>
      ) : mode === "reset-password" ? (
        <>
          <TokenForm reset />
          <Link href="/forgot-password">Request another link</Link>
        </>
      ) : (
        <>
          {mode === "verify-email" && <TokenForm />}
          <form action={mode === "verify-email" ? a.resend : a.recover}>
            <Field name="email" type="email" label="Email address" />
            <Submit>
              {mode === "verify-email"
                ? "Resend verification email"
                : "Request recovery email"}
            </Submit>
          </form>
          <Link href="/login">Back to login</Link>
        </>
      )}
    </>
  );
}
