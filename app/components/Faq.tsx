import { FaqList } from "./FaqList";

export interface Question {
  question: string;
  answer: string;
}

const questions: Question[] = [
  {
    question: "When will it start?",
    answer:
      "No release date decided yet but you can expect it after December 2026 or January 2027",
  },
  {
    question: "How does it work?",
    answer:
      "make something you wanted to make forever or just a random idea > submit to wonders > wait for your surprise.",
  },
  {
    question: "Payouts?",
    answer:
      "No payouts, no hours system just make projects and submit them! no currency no shop just surprises.",
  },
  {
    question: "Hardware or Software?",
    answer: "Both!! you can do hardware & software both.",
  },
  {
    question: "Only big projects?",
    answer:
      "Hell no, you can submit anything small, don't target to make something large make small projects, cool idea, random shii idea (no offense), ANYTHINGGGGGG you can create, ideas you can think of nobody else.",
  },
  {
    question: "For beginners?",
    answer:
      "Hell yeaaaaaaaaaaaa, this is for everyone beginner, advanced ANYONEEEEEEE",
  },
  {
    question: "Can i use AI?",
    answer:
      "Uhhhhh AI? (kidding) but uh keep it under 25% and you'll be just fine",
  },
  {
    question: "When does time tracking start?",
    answer: "Uhhh let it release first gng but anyways not decided yet.",
  },
];

export function Faq() {
  return (
    <div className="relative w-full overflow-hidden bg-white">
      <div
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/bg-effect-2.png')" }}
      />

      <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-20 font-phantom font-normal text-black">
        <h2 className="font-finger-paint text-5xl text-[#3d6b1f] md:text-6xl">
          FAQ
        </h2>

        <div
          className="mt-10 flex w-full flex-col px-4 py-2 sm:px-8"
          style={{
            borderStyle: "solid",
            borderWidth: "64px",
            borderImage: "url('/text-area.png') 140 stretch",
          }}
        >
          <FaqList questions={questions} />
        </div>

        <p className="mt-10 text-center text-black">
          Anything else???? Just ask it in #wonders!
        </p>
      </div>
    </div>
  );
}
