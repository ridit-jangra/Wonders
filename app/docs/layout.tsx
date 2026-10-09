/* eslint-disable @next/next/no-img-element */
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider/next";
import { source } from "@/lib/source";
import "./docs.css";

export default function DocsRootLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="wonders-docs relative isolate flex flex-1 flex-col">
      <img
        className="fixed inset-0 -z-10 h-full w-full object-cover"
        src="/bg-effect-4.png"
        alt=""
      />
      <RootProvider theme={{ enabled: false }}>
        <DocsLayout
          tree={source.getPageTree()}
          nav={{
            title: <img src="/logo.png" alt="Wonders" className="h-10 w-auto" />,
            url: "/",
          }}
          themeSwitch={{ enabled: false }}
          links={[
            { text: "Dashboard :)", url: "/dashboard" },
            { text: "Explore :3", url: "/explore" },
          ]}
        >
          {children}
        </DocsLayout>
      </RootProvider>
    </div>
  );
}
