"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button that disables itself while its form's Server Action runs, so a
 * second click can't fire the same action twice.
 * `useFormStatus` reads the status of the nearest parent <form>, which is why
 * this has to be its own component rather than inlined in the page.
 */
export default function SubmitButton({
  children,
  pendingLabel,
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
