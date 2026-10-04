import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { ThemeControl } from "@/components/theme-control";
import { parseTheme, themeCookie } from "@/theme";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = parseTheme((await cookies()).get(themeCookie)?.value);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex min-h-9 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="text-xs">RepoVisualizer</span>
        <OrganizationSwitcher
          hidePersonal
          afterCreateOrganizationUrl="/"
          afterSelectOrganizationUrl="/"
        />
        <div className="ml-auto flex items-center gap-2">
          <ThemeControl theme={theme} />
          <UserButton />
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
