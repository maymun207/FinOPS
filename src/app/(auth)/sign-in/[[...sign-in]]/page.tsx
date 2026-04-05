import { SignIn } from "@clerk/nextjs";

/**
 * Sign-in page — renders Clerk's pre-built SignIn component.
 * Centered on the page with the FinOPS branding.
 */
export default function SignInPage() {
  return (
    <div className="auth-container">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
