import Link from "next/link";

export default function BackButton({ href, label = "back" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="w-fit rounded-md bg-[#D0E4B4] px-3 py-1 font-finger-paint text-base text-black/50 transition-all hover:zoom-110 md:hidden"
    >
      &lt;- {label}
    </Link>
  );
}
