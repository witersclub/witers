// Single source of truth for the one-time "paquetes de imágenes" add-on —
// extra solicitudes a member can buy on top of their monthly quota without
// upgrading plans (built for members like Atlantic Essential who only ever
// request images and don't need Grow's carousel/video benefits). Mirrors
// membership-plans.ts: same precioRegular = precioPromo / 0.7 anchor-price
// formula used for the 30%-off framing on every priced offering in the app.
// Safe to import from both client and server code (no secrets, no side
// effects). Bonus solicitudes never expire and stack with any plan.

export type ImagePackId = "pack10" | "pack20" | "pack30";

export type ImagePack = {
  id: ImagePackId;
  images: number;
  precioPromo: number;
  precioRegular: number;
};

export const IMAGE_PACKS: ImagePack[] = [
  { id: "pack10", images: 10, precioPromo: 1999, precioRegular: 2855.71 },
  { id: "pack20", images: 20, precioPromo: 3999, precioRegular: 5712.86 },
  { id: "pack30", images: 30, precioPromo: 4999, precioRegular: 7141.43 },
];

export function isImagePackId(value: unknown): value is ImagePackId {
  return typeof value === "string" && IMAGE_PACKS.some((p) => p.id === value);
}

export function getImagePack(id: string | null | undefined): ImagePack {
  return IMAGE_PACKS.find((p) => p.id === id) ?? IMAGE_PACKS[0];
}
