/* eslint-disable @next/next/no-img-element */
export default function WonderImage({ src }: { src: string | null }) {
  return (
    <div className="relative aspect-438/206 w-full">
      <img src="/project-image-fallback.png" alt="" className="absolute inset-0 h-full w-full" />
      {src && (
        <img
          src={src}
          alt=""
          className="absolute top-[1%] left-[3.7%] h-[92.7%] w-[94.9%] overflow-hidden rounded-sm object-cover"
        />
      )}
    </div>
  );
}
