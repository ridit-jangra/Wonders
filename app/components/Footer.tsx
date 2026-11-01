const LINKS = [
  { label: "Hack Club", href: "https://hackclub.com/" },
  { label: "Privacy policy", href: "https://hackclub.com/privacy-and-terms" },
  { label: "Fulfillment bounty", href: "https://forms.hackclub.com/bounty" },
];

export function Footer() {
  return (
    <div className="relative w-full min-h-[100svh] bg-white overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: "url('/bg-effect-2.png')" }}
      />
      <div
        className="absolute inset-0 bg-no-repeat bg-right bg-cover z-10 landscape:hidden"
        style={{ backgroundImage: "url('/cliff-with-guy-and-heart-mobile.png')" }}
      />
      <div
        className="absolute inset-0 bg-no-repeat bg-center bg-cover z-10 hidden landscape:block"
        style={{ backgroundImage: "url('/cliff-with-guy-and-heart-without-wonderful-text.png')" }}
      />

      <nav className="absolute bottom-5 left-1/2 z-30 flex -translate-x-1/2 flex-wrap justify-center gap-x-5 gap-y-1 px-4 font-finger-paint text-sm text-[#2F5A62]">
        {LINKS.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap hover:underline"
          >
            {link.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
