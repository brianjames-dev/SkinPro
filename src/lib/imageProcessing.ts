import sharp from "sharp";

type NormalizeOptions = {
  strict?: boolean;
};

export async function normalizeImageOrientation(
  buffer: Buffer,
  options: NormalizeOptions = {}
): Promise<Buffer> {
  try {
    return await sharp(buffer, { failOn: "none" }).rotate().toBuffer();
  } catch (error) {
    if (options.strict) {
      throw error;
    }
    return buffer;
  }
}
