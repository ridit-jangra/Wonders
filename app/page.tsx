import { Faq } from "./components/Faq";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { HowThisWorks } from "./components/HowThisWorks";
import { Story } from "./components/Story";

export default function Home() {
  return (
    <div>
      <Hero />
      <Story />
      <HowThisWorks />
      <Faq />
      <Footer />
    </div>
  );
}
