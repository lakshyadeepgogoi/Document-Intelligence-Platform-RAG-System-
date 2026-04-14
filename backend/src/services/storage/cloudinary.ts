import { v2 as cloudinary } from 'cloudinary';
import { config } from '../../config';

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
  secure: true,
});

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  bytes: number;
}

/**
 * Upload a file buffer to Cloudinary as a raw file (for PDFs/DOCX/PPT).
 */
export function uploadBuffer(
  buffer: Buffer,
  options: { folder?: string; filename: string } = { filename: 'upload' }
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: options.folder || 'docint',
        public_id: `${Date.now()}-${options.filename.replace(/\.[^/.]+$/, '')}`,
        use_filename: false,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary upload failed'));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          bytes: result.bytes,
        });
      }
    );
    stream.end(buffer);
  });
}

/**
 * Delete a file from Cloudinary by public ID.
 */
export async function deleteFile(publicId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  } catch (err) {
    console.warn(`[Cloudinary] Failed to delete ${publicId}:`, err);
  }
}

/**
 * Download a file from Cloudinary (or any URL) as a Buffer.
 */
export async function downloadAsBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
