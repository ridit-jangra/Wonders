import { YSWS } from "@/lib/ysws-config";

export const SITE_TITLE = "Wonders | Hack Club YSWS for small, creative projects";

export const SITE_DESCRIPTION =
  "Wonders is a Hack Club YSWS (You Ship, We Ship). Make a project you have wanted to make, hardware or software, big or small, ship it, and get a surprise. No hour minimum, for beginners and up, for teens.";

export const SITE_KEYWORDS = [
  "Wonders",
  "Wonders Hack Club",
  "Hack Club Wonders",
  "wonders hackclub",
  "Wonders YSWS",
  "Hack Club YSWS",
  "You Ship We Ship",
  "Hack Club",
  "teen coding program",
  "free projects for teenagers",
  "hardware and software projects",
  "ship a project get a prize",
];

const ORGANIZATION = {
  "@type": "Organization",
  "@id": "https://hackclub.com/#organization",
  name: "Hack Club",
  url: "https://hackclub.com",
};

function absolute(path: string) {
  return `${YSWS.origin}${path}`;
}

export function organizationJsonLd() {
  return { "@context": "https://schema.org", ...ORGANIZATION };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": absolute("/#website"),
    name: YSWS.name,
    alternateName: ["Hack Club Wonders", "Wonders YSWS", "wonders hackclub"],
    url: absolute("/"),
    description: SITE_DESCRIPTION,
    inLanguage: "en",
    publisher: ORGANIZATION,
  };
}

export function eventJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: "Wonders, a Hack Club YSWS",
    description: SITE_DESCRIPTION,
    startDate: YSWS.startsIso,
    endDate: YSWS.endsIso,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: { "@type": "VirtualLocation", url: absolute("/") },
    image: [absolute("/opengraph-image.png")],
    organizer: ORGANIZATION,
    isAccessibleForFree: true,
    url: absolute("/"),
    offers: {
      "@type": "Offer",
      url: absolute("/"),
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
  };
}

export function faqJsonLd(questions: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function creativeWorkJsonLd(wonder: {
  id: number;
  title: string;
  description: string;
  image: string;
  makers: string[];
  repo: string | null;
  demo: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: wonder.title,
    description: wonder.description.slice(0, 300),
    image: wonder.image,
    url: absolute(`/w/${wonder.id}`),
    author: wonder.makers.map((name) => ({ "@type": "Person", name })),
    publisher: ORGANIZATION,
    isPartOf: { "@id": absolute("/#website") },
    ...(wonder.repo ? { codeRepository: wonder.repo } : {}),
    ...(wonder.demo ? { sameAs: [wonder.demo] } : {}),
  };
}

export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
