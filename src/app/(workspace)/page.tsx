import { auth } from "@clerk/nextjs/server";

export default async function WorkspacePage() {
  const { orgId, sessionClaims } = await auth();
  const orgName = sessionClaims?.org_name?.trim() ?? "";

  return (
    <div className="px-3 py-3">
      <p className="text-xs text-muted">Organization</p>
      {orgId ? (
        <>
          {orgName ? <p className="text-pretty">{orgName}</p> : null}
          <p className="font-mono text-xs">{orgId}</p>
        </>
      ) : (
        <p className="text-pretty">No organization on this session.</p>
      )}
    </div>
  );
}
