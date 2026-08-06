// Downloads a file from /api/file via a fetched blob + a same-page
// <a download> click, instead of a plain <a href> navigation. That plain
// navigation to a Content-Disposition: attachment URL hands the whole
// screen, on an installed home-screen PWA (iOS), over to a native
// file-preview viewer with no way back — the app appears to "go black" and
// gets stuck, since there's no button or gesture to return from it. A
// same-page blob link never navigates away, so that screen never appears.
// Falls back to the old navigation only if the fetch itself fails (e.g. a
// cross-origin URL a same-origin fetch can't reach), so a download never
// just silently does nothing.
export async function downloadFileByKey(fileKey: string): Promise<void> {
  const href = `/api/file?key=${encodeURIComponent(fileKey)}&download=1`;
  try {
    const res = await fetch(href, { credentials: "include" });
    if (!res.ok) throw new Error("download_failed");
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") ?? "";
    const filename = /filename="?([^"]+)"?/.exec(disposition)?.[1] ?? "witers.png";
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.location.href = href;
  }
}
