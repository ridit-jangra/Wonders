/* eslint-disable @next/next/no-img-element */
import { cookies } from "next/headers";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source } from "@/lib/source";
import DocsSidebar, { type DocsSidebarPage } from "./components/DocsSidebar";
import { DOCS_SIDEBAR_COOKIE } from "./components/sidebar-cookie";
import "./docs.css";

export default async function DocsRootLayout({ children }: LayoutProps<"/docs">) {
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get(DOCS_SIDEBAR_COOKIE)?.value === "collapsed";
  const tree = source.getPageTree();
  const pages: DocsSidebarPage[] = [];
  for (const node of tree.children) {
    if (node.type === "page") {
      pages.push({ url: node.url, title: String(node.name) });
    }
  }

  return (
    <div className="wonders-docs relative isolate flex flex-1 flex-col">
      <img
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/bg-effect-4.png"
        alt=""
      />
      <RootProvider theme={{ enabled: false }}>
        <div className="relative flex min-h-screen">
          <DocsSidebar pages={pages} initialCollapsed={sidebarCollapsed} />
          <div className="min-w-0 flex-1 pt-14 md:pt-0">
            <DocsLayout
              tree={tree}
              nav={{ enabled: false }}
              sidebar={{ enabled: false }}
              themeSwitch={{ enabled: false }}
            >
              {children}
            </DocsLayout>
          </div>
        </div>
      </RootProvider>
    </div>
  );
}
