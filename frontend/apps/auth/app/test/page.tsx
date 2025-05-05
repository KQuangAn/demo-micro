"use client";

import { useSession } from "@repo/auth";

export default function Page() {
  const { data: session, status } = useSession();
  console.log(session, status, 1241234);
  return <div className="flex gap-6">fqwef</div>;
}
