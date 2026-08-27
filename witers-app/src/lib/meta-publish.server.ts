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

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { message?: string };
  };
  if (!response.ok) {
    console.info("[meta-publish] graph call failed", path, body.error?.message);
    return { ok: false, error: (body.error?.message as string) || "meta_error" };
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
