// Discovers the WhatsApp Business phone numbers a client's connected Meta
// login actually has access to — used to offer a real destination picker
// in the "Pautar" wizard instead of a free-text number nobody validates.
//
// Endpoint and field names below are the ones Meta's own Business SDK
// examples use for this exact lookup (a Business's owned WhatsApp Business
// Accounts, each with its phone numbers):
//   GET /me/businesses?fields=name,owned_whatsapp_business_accounts{
//         phone_numbers{verified_name,display_phone_number,status,name_status}}
// Requires the whatsapp_business_management scope (see
// meta-ad-account-auth.server.ts) — without it Meta returns the businesses
// but with an empty/missing owned_whatsapp_business_accounts edge, which
// reads here as "no numbers found," not as an error.
import { META_GRAPH_BASE } from "./meta-graph-version.server";

export type MetaWhatsAppNumber = {
  phoneNumberId: string;
  displayNumber: string;
  verifiedName: string | null;
  status: string | null;
};

type PhoneNumberNode = {
  id: string;
  display_phone_number: string;
  verified_name?: string;
  status?: string;
};
type WabaNode = { id: string; phone_numbers?: { data?: PhoneNumberNode[] } };
type BusinessNode = {
  id: string;
  name?: string;
  owned_whatsapp_business_accounts?: { data?: WabaNode[] };
};

export async function listMetaWhatsAppNumbers(
  accessToken: string,
): Promise<{ ok: true; numbers: MetaWhatsAppNumber[] } | { ok: false; error: string }> {
  const url = new URL(`${META_GRAPH_BASE}/me/businesses`);
  url.searchParams.set(
    "fields",
    "name,owned_whatsapp_business_accounts{phone_numbers{verified_name,display_phone_number,status,name_status}}",
  );
  url.searchParams.set("access_token", accessToken);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    return { ok: false, error: "tiempo_agotado" };
  }
  const data = (await response.json().catch(() => ({}))) as {
    data?: BusinessNode[];
    error?: { error_user_msg?: string; message?: string };
  };
  if (!response.ok) {
    return { ok: false, error: data.error?.error_user_msg ?? data.error?.message ?? "meta_error" };
  }
  const numbers: MetaWhatsAppNumber[] = [];
  for (const business of data.data ?? []) {
    for (const waba of business.owned_whatsapp_business_accounts?.data ?? []) {
      for (const phone of waba.phone_numbers?.data ?? []) {
        numbers.push({
          phoneNumberId: phone.id,
          displayNumber: phone.display_phone_number,
          verifiedName: phone.verified_name ?? null,
          status: phone.status ?? null,
        });
      }
    }
  }
  return { ok: true, numbers };
}

// The Ad Set's promoted_object.whatsapp_phone_number field takes plain
// digits (see meta-ads-create.server.ts's resolveDestinationLink for the
// same digit-stripping already used for the current wa.me link) — not the
// opaque phoneNumberId, and not Meta's parenthesized/spaced display format.
export function digitsOnly(displayNumber: string): string {
  return displayNumber.replace(/\D/g, "");
}
