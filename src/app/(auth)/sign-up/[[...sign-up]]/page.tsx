import { SignUp } from "@clerk/nextjs";

/**
 * Sign-up page — renders Clerk's pre-built SignUp component.
 * Centered on the page with the FinOPS branding.
 */
export default function SignUpPage() {
  return (
    <div className="auth-container">
      <SignUp
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
