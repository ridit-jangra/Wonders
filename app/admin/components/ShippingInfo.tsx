"use client";

import { useState, useTransition } from "react";
import { Button, ButtonLink, Callout, DescriptionList, Mono } from "./ui";

export interface ShippingData {
  name: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal: string;
  country: string;
}

export type ShippingResult =
  | { ok: true; data: ShippingData }
  | { ok: false; reason: "locked" | "missing" | "denied" | "limited" };

export default function ShippingInfo({
  load,
  reauthHref,
}: {
  load: () => Promise<ShippingResult>;
  reauthHref: string;
}) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ShippingResult | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && (!result || !result.ok)) {
      startTransition(async () => {
        setResult(await load());
      });
    }
    if (!next) {
      setResult(null);
    }
  }

  return (
    <div className="mt-4">
      <Button type="button" variant="outline" size="sm" icon="map-pin" onClick={toggle} aria-expanded={open}>
        {open ? "Hide shipping info" : "Shipping info"}
      </Button>
      {open && (
        <div className="mt-3">
          {pending && <p className="hc-caption text-sm">Loading…</p>}
          {!pending && result && !result.ok && result.reason === "locked" && (
            <div className="flex flex-col gap-3">
              <Callout tone="info" icon="private">
                Shipping details are hidden. Sign in again to Hack Club Auth to view them; it&apos;s logged.
              </Callout>
              <div>
                <ButtonLink href={reauthHref} variant="cream" size="sm">
                  Verify it&apos;s you
                </ButtonLink>
              </div>
            </div>
          )}
          {!pending && result && !result.ok && result.reason === "missing" && (
            <Callout tone="warning">No address on file yet. They need to log in again to sync it.</Callout>
          )}
          {!pending && result && !result.ok && result.reason === "limited" && (
            <Callout tone="warning">Slow down a little, then try again.</Callout>
          )}
          {!pending && result && !result.ok && result.reason === "denied" && (
            <Callout tone="danger">You can&apos;t view this.</Callout>
          )}
          {!pending && result && result.ok && (
            <>
              <DescriptionList
                items={[
                  ["Name", result.data.name],
                  ["Phone", result.data.phone ? <Mono key="phone">{result.data.phone}</Mono> : null],
                  [
                    "Address",
                    result.data.line1 ? (
                      <address key="address" className="not-italic">
                        {result.data.line1}
                        {result.data.line2 && (
                          <>
                            <br />
                            {result.data.line2}
                          </>
                        )}
                        <br />
                        {[result.data.city, result.data.state, result.data.postal].filter(Boolean).join(", ")}
                        <br />
                        {result.data.country}
                      </address>
                    ) : null,
                  ],
                ]}
              />
              <p className="hc-caption mt-3 text-xs">Synced from Hack Club Auth on each login. Viewing this is logged.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
