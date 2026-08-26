import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to Signoff, Growthpad Consulting Group's signature builder and deployment platform.",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
