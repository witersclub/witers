// Graph API calls that actually publish a piece to a connected Instagram
// account or Facebook Page. Callers pass already-public image URLs (either
// the AI-generation CDN url, or one built from
// /api/public/calendar-media.ts). Instagram is connected directly (see
// instagram-login-auth.server.ts) so its calls go to graph.instagram.com
// with that account's own access token; Facebook Pages stay on
// graph.facebook.com with the Page's access token — different hosts, same
// container → publish shape. Server-only.

const GRAPH_VERSION = "v21.0";
const FACEBOOK_GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const INSTAGRAM_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

export type PublishResult = { ok: true; externalPostId: string } | { ok: false; error: string };
export type ProcessingResult =
  | { state: "processing" }
  | { state: "ready" }
  | { state: "success"; externalPostId: string }
  | { state: "error"; error: string };

type MetaErrorBody = {
  error?: { message?: string; error_user_msg?: string };
  message?: string;
};

// Meta occasionally returns a plain-text or HTML error from rupload instead
// of the usual Graph JSON. Keep a short, user-safe reason in D1 and log the
// HTTP status, rather than replacing the useful cause with a generic label.
async function readMetaError(response: Response, fallback: string): Promise<string> {
  const raw = await response.text().catch(() => "");
  let message = "";
  try {
    const body = JSON.parse(raw) as MetaErrorBody;
    message = body.error?.error_user_msg ?? body.error?.message ?? body.message ?? "";
  } catch {
    // Non-JSON responses are common for CDN fetch failures. Do not store an
    // HTML document in the database or surface it to the customer.
  }
  const normalized = message.replace(/\s+/g, " ").trim().slice(0, 500);
  console.info("[meta-publish] Meta request failed", response.status, normalized || fallback);
  return normalized || `${fallback} (HTTP ${response.status})`;
}

async function graphPost(
  base: string,
  path: string,
  params: Record<string, string>,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text().catch(() => "");
  const body = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown> & MetaErrorBody;
    } catch {
      return {} as Record<string, unknown> & MetaErrorBody;
    }
  })();
  if (!response.ok) {
    const message = body.error?.error_user_msg ?? body.error?.message ?? body.message;
    const normalized = message?.replace(/\s+/g, " ").trim().slice(0, 500);
    console.info("[meta-publish] graph call failed", path, response.status, normalized || "meta_error");
    return { ok: false, error: normalized || `meta_error (HTTP ${response.status})` };
  }
  return { ok: true, body };
}

async function graphGet(
  base: string,
  path: string,
  params: Record<string, string>,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; error: string }> {
  const url = new URL(`${base}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  let response: Response;
  try {
    response = await fetch(url.toString());
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  const raw = await response.text().catch(() => "");
  const body = (() => {
    try {
      return JSON.parse(raw) as Record<string, unknown> & MetaErrorBody;
    } catch {
      return {} as Record<string, unknown> & MetaErrorBody;
    }
  })();
  if (!response.ok) {
    const message = body.error?.error_user_msg ?? body.error?.message ?? body.message;
    const normalized = message?.replace(/\s+/g, " ").trim().slice(0, 500);
    console.info("[meta-publish] graph read failed", path, response.status, normalized || "meta_error");
    return { ok: false, error: normalized || `meta_error (HTTP ${response.status})` };
  }
  return { ok: true, body };
}

// Instagram creates a media container synchronously (the /media call
// returns an id right away) but actually fetches/processes the image
// asynchronously — publishing (or referencing it as a carousel child)
// before it reaches status_code "FINISHED" fails with "Media ID is not
// available". A single image usually clears this by the time the next
// call happens, but a carousel's 4 back-to-back child creations often
// don't — poll until each container is genuinely ready before moving on.
async function waitForContainerReady(
  creationId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const url = new URL(`${INSTAGRAM_GRAPH_BASE}/${creationId}`);
    url.searchParams.set("fields", "status_code");
    url.searchParams.set("access_token", accessToken);
    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch {
      return { ok: false, error: "tiempo_agotado" };
    }
    const body = (await response.json().catch(() => ({}))) as {
      status_code?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      console.info("[meta-publish] container status check failed", body.error?.message);
      return { ok: false, error: body.error?.message ?? "meta_error" };
    }
    if (body.status_code === "FINISHED") return { ok: true };
    if (body.status_code === "ERROR" || body.status_code === "EXPIRED") {
      return { ok: false, error: `contenedor_${body.status_code.toLowerCase()}` };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return { ok: false, error: "tiempo_agotado_procesando" };
}

// Reels are deliberately split into creation and final publishing. Meta fetches
// and encodes the video asynchronously, so the calendar's cron worker checks
// this container later instead of holding an HTTP request open.
export async function createInstagramReel(
  igUserId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
): Promise<{ ok: true; processingId: string } | { ok: false; error: string }> {
  const container = await graphPost(INSTAGRAM_GRAPH_BASE, `/${igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
    access_token: accessToken,
  });
  if (!container.ok) return container;
  const processingId = container.body.id as string | undefined;
  return processingId ? { ok: true, processingId } : { ok: false, error: "sin_creation_id" };
}

export async function checkInstagramReel(
  creationId: string,
  accessToken: string,
): Promise<ProcessingResult> {
  const result = await graphGet(INSTAGRAM_GRAPH_BASE, `/${creationId}`, {
    fields: "status_code,status",
    access_token: accessToken,
  });
  if (!result.ok) return { state: "error", error: result.error };
  const status = result.body.status_code;
  if (status === "FINISHED") return { state: "ready" };
  if (status === "PUBLISHED") {
    return { state: "success", externalPostId: (result.body.id as string) ?? creationId };
  }
  if (status === "ERROR" || status === "EXPIRED") {
    return { state: "error", error: `contenedor_${status.toLowerCase()}` };
  }
  return { state: "processing" };
}

export async function publishInstagramReel(
  igUserId: string,
  accessToken: string,
  creationId: string,
): Promise<PublishResult> {
  const publish = await graphPost(INSTAGRAM_GRAPH_BASE, `/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  if (!publish.ok) return publish;
  return { ok: true, externalPostId: (publish.body.id as string) ?? creationId };
}

// Facebook Reels uses its resumable-upload API even when Meta fetches from a
// URL. The initial two calls are short; the encoding/publish result is checked
// by the same cron worker as Instagram.
export async function createFacebookReel(
  pageId: string,
  accessToken: string,
  videoUrl: string,
  caption: string,
): Promise<{ ok: true; processingId: string } | { ok: false; error: string }> {
  const start = await graphPost(FACEBOOK_GRAPH_BASE, `/${pageId}/video_reels`, {
    upload_phase: "start",
    access_token: accessToken,
  });
  if (!start.ok) return start;
  const processingId = start.body.video_id as string | undefined;
  if (!processingId) return { ok: false, error: "sin_video_id" };

  let upload: Response;
  try {
    upload = await fetch(`https://rupload.facebook.com/video-upload/${GRAPH_VERSION}/${processingId}`, {
      method: "POST",
      headers: { Authorization: `OAuth ${accessToken}`, file_url: videoUrl },
    });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  if (!upload.ok) {
    return { ok: false, error: await readMetaError(upload, "carga_video_fallida") };
  }

  const finish = await graphPost(FACEBOOK_GRAPH_BASE, `/${pageId}/video_reels`, {
    upload_phase: "finish",
    video_id: processingId,
    video_state: "PUBLISHED",
    description: caption,
    access_token: accessToken,
  });
  if (!finish.ok) return finish;
  return { ok: true, processingId };
}

export async function checkFacebookReel(
  processingId: string,
  accessToken: string,
): Promise<ProcessingResult> {
  const result = await graphGet(FACEBOOK_GRAPH_BASE, `/${processingId}`, {
    fields: "status",
    access_token: accessToken,
  });
  if (!result.ok) return { state: "error", error: result.error };
  const serialized = JSON.stringify(result.body.status ?? {}).toLowerCase();
  if (serialized.includes("error") || serialized.includes("failed")) {
    return { state: "error", error: "procesamiento_video_fallido" };
  }
  if (serialized.includes("published") || serialized.includes("complete") || serialized.includes("ready")) {
    return { state: "success", externalPostId: processingId };
  }
  return { state: "processing" };
}

export async function publishImageToInstagram(
  igUserId: string,
  accessToken: string,
  imageUrl: string,
  caption: string,
): Promise<PublishResult> {
  const container = await graphPost(INSTAGRAM_GRAPH_BASE, `/${igUserId}/media`, {
    image_url: imageUrl,
    caption,
    access_token: accessToken,
  });
  if (!container.ok) return container;
  const creationId = container.body.id as string | undefined;
  if (!creationId) return { ok: false, error: "sin_creation_id" };

  const ready = await waitForContainerReady(creationId, accessToken);
  if (!ready.ok) return ready;

  const publish = await graphPost(INSTAGRAM_GRAPH_BASE, `/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  if (!publish.ok) return publish;
  return { ok: true, externalPostId: (publish.body.id as string) ?? creationId };
}

export async function publishCarouselToInstagram(
  igUserId: string,
  accessToken: string,
  imageUrls: string[],
  caption: string,
): Promise<PublishResult> {
  const childIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const child = await graphPost(INSTAGRAM_GRAPH_BASE, `/${igUserId}/media`, {
      image_url: imageUrl,
      is_carousel_item: "true",
      access_token: accessToken,
    });
    if (!child.ok) return child;
    const childId = child.body.id as string | undefined;
    if (!childId) return { ok: false, error: "sin_creation_id" };
    const childReady = await waitForContainerReady(childId, accessToken);
    if (!childReady.ok) return childReady;
    childIds.push(childId);
  }

  const container = await graphPost(INSTAGRAM_GRAPH_BASE, `/${igUserId}/media`, {
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption,
    access_token: accessToken,
  });
  if (!container.ok) return container;
  const creationId = container.body.id as string | undefined;
  if (!creationId) return { ok: false, error: "sin_creation_id" };

  const ready = await waitForContainerReady(creationId, accessToken);
  if (!ready.ok) return ready;

  const publish = await graphPost(INSTAGRAM_GRAPH_BASE, `/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  });
  if (!publish.ok) return publish;
  return { ok: true, externalPostId: (publish.body.id as string) ?? creationId };
}

export async function publishImageToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  imageUrl: string,
  caption: string,
): Promise<PublishResult> {
  const result = await graphPost(FACEBOOK_GRAPH_BASE, `/${pageId}/photos`, {
    url: imageUrl,
    caption,
    access_token: pageAccessToken,
  });
  if (!result.ok) return result;
  const postId = (result.body.post_id as string) ?? (result.body.id as string | undefined);
  if (!postId) return { ok: false, error: "sin_post_id" };
  return { ok: true, externalPostId: postId };
}

export async function publishCarouselToFacebookPage(
  pageId: string,
  pageAccessToken: string,
  imageUrls: string[],
  caption: string,
): Promise<PublishResult> {
  const mediaIds: string[] = [];
  for (const imageUrl of imageUrls) {
    const photo = await graphPost(FACEBOOK_GRAPH_BASE, `/${pageId}/photos`, {
      url: imageUrl,
      published: "false",
      access_token: pageAccessToken,
    });
    if (!photo.ok) return photo;
    const id = photo.body.id as string | undefined;
    if (!id) return { ok: false, error: "sin_media_id" };
    mediaIds.push(id);
  }

  const post = await graphPost(FACEBOOK_GRAPH_BASE, `/${pageId}/feed`, {
    message: caption,
    attached_media: JSON.stringify(mediaIds.map((id) => ({ media_fbid: id }))),
    access_token: pageAccessToken,
  });
  if (!post.ok) return post;
  const postId = post.body.id as string | undefined;
  if (!postId) return { ok: false, error: "sin_post_id" };
  return { ok: true, externalPostId: postId };
}
