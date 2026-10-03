// Imported at startup. A missing value throws here rather than on a later screen.

type EnvName =
  | "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
  | "CLERK_SECRET_KEY"
  | "NEXT_PUBLIC_CLERK_SIGN_IN_URL"
  | "NEXT_PUBLIC_CLERK_SIGN_UP_URL"
  | "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL"
  | "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY";

function required(name: EnvName): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing environment variable ${name}`);
  }
  return value;
}

const clerkSignInFallbackRedirectUrl = required(
  "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL",
);
const clerkSignUpFallbackRedirectUrl = required(
  "NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL",
);

if (clerkSignInFallbackRedirectUrl !== clerkSignUpFallbackRedirectUrl) {
  throw new Error(
    "NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL and NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL must be the same URL",
  );
}

export const env = {
  clerkPublishableKey: required("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"),
  clerkSecretKey: required("CLERK_SECRET_KEY"),
  clerkSignInUrl: required("NEXT_PUBLIC_CLERK_SIGN_IN_URL"),
  clerkSignUpUrl: required("NEXT_PUBLIC_CLERK_SIGN_UP_URL"),
  clerkAfterSignInUrl: clerkSignInFallbackRedirectUrl,
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  supabasePublishableKey: required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
};
