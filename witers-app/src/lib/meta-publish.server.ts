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
