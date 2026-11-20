import Link from "next/link";

/** Internal event pages ("/events/<id>") open in the app; public Luma/Partiful pages open in a new tab. */
export default function EventLink({ url, className, children }: { url?: string; className?: string; children: React.ReactNode }) {
  if (!url) return null;
  if (url.startsWith("/")) {
    return (
      <Link href={url} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
    </a>
  );
}
