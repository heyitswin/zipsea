import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <h1 className="font-whitney text-[72px] font-black uppercase text-[#0E1B4D]">404</h1>
      <h2 className="mt-4 font-geograph text-[24px] text-[#0E1B4D]">Page Not Found</h2>
      <p className="mt-2 font-geograph text-[16px] text-[#666]">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-full bg-[#2238C3] px-8 py-3 font-geograph font-semibold text-white hover:bg-[#1a2a9a] transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
