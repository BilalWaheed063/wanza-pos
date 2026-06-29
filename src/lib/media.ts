import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "app-media";
export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const IMAGE_ACCEPT = ALLOWED_IMAGE_MIME_TYPES.join(",");
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateImageFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (
    !ALLOWED_IMAGE_MIME_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number]) ||
    !extension ||
    !ALLOWED_IMAGE_EXTENSIONS.includes(extension as (typeof ALLOWED_IMAGE_EXTENSIONS)[number])
  ) {
    throw new Error("Only JPG, PNG and WebP image files are allowed.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image size must be 5MB or less. Please upload a compressed WebP image.");
  }
}

export async function uploadPublicImage(file: File, folder: string) {
  validateImageFile(file);

  const extension = file.name.split(".").pop()?.toLowerCase() || "webp";
  const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, "-").replace(/\/+/g, "/");
  const filename = `${crypto.randomUUID()}.${extension}`;
  const path = `${safeFolder}/${filename}`;

  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type,
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}