/* eslint-disable @next/next/no-img-element */
export function Footer() {
  return (
    <div className="relative w-full min-h-[100svh] bg-white overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center z-0"
        style={{ backgroundImage: "url('/bg-effect-2.png')" }}
      />
      <div
        className="absolute inset-0 bg-no-repeat bg-right bg-cover z-10 md:hidden"
        style={{ backgroundImage: "url('/cliff-with-guy-and-heart-mobile.png')" }}
      />
      <div
        className="absolute inset-0 bg-no-repeat bg-center bg-cover z-10 hidden md:block"
        style={{ backgroundImage: "url('/cliff-with-guy-and-heart-without-wonderful-text.png')" }}
      />
    </div>
  );
}
