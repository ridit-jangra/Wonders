import type { Metadata } from "next";
import { Faq, questions } from "./components/Faq";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { HowThisWorks } from "./components/HowThisWorks";
import { Story } from "./components/Story";
import { eventJsonLd, faqJsonLd, jsonLdScript, organizationJsonLd, websiteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
};

export default function Home() {
  const structured = [organizationJsonLd(), websiteJsonLd(), eventJsonLd(), faqJsonLd(questions)];
  return (
    <main>
      {structured.map((data, index) => (
        <script key={index} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }} />
      ))}
      <Hero />
      <Story />
      <HowThisWorks />
      <Faq />
      <Footer />
    </main>
  );
}
