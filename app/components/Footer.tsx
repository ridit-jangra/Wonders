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

      <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden [container-type:size] landscape:hidden">
        <div className="absolute top-1/2 right-0 aspect-[900/1500] w-[max(100cqw,calc(100cqh*0.6))] -translate-y-1/2">
          <a
            href="https://hackclub.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hack Club"
            className="pointer-events-auto absolute top-[27%] left-[35%] h-[15%] w-[37%]"
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 z-20 hidden overflow-hidden [container-type:size] landscape:block">
        <div className="absolute top-1/2 left-1/2 aspect-[1920/1080] w-[max(100cqw,calc(100cqh*1.7778))] -translate-x-1/2 -translate-y-1/2">
          <a
            href="https://hackclub.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Hack Club"
            className="pointer-events-auto absolute top-[68%] left-[72%] h-[26%] w-[22%]"
          />
        </div>
      </div>

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
