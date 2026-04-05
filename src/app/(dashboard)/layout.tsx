import React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

/**
 * Dashboard layout — protected route group.
 *
 * Redirects unauthenticated users to /sign-in.
 * This is a server component that checks auth on each request.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <>{children}</>;
}
