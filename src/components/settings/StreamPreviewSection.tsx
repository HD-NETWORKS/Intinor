"use client";

import { Thumbnail } from "@/components/Thumbnail";

/** Live preview + snapshot download, shown above a settings form so you can see what you're editing. */
export function StreamPreviewSection({
  thumbId,
  urlBuilder,
  alt,
  downloadFilename,
}: {
  /** Undefined while loading or when the pipe has no thumbnail yet — renders nothing rather than a broken image. */
  thumbId: string | undefined;
  urlBuilder: (id: string, opts: { ppm: boolean }) => string;
  alt: string;
  downloadFilename: string;
}) {
  if (!thumbId) return null;

  return (
    <section className="space-y-3 rounded-lg border border-border-default bg-panel p-4">
      <h2 className="font-medium text-body">Preview</h2>
      <Thumbnail alt={alt} urlBuilder={(opts) => urlBuilder(thumbId, opts)} downloadFilename={downloadFilename} />
    </section>
  );
}
