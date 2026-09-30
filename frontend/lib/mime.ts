/**
 * The MIME type to upload a captured photo as. The backend accepts only
 * image/jpeg and image/png.
 *
 * `format` is expo-camera's `CameraCapturedPicture.format` ('jpg' | 'png'),
 * passed along as a route param. Without it the file extension decides, and
 * anything unrecognised is sent as JPEG.
 */
export function mimeTypeFor(format: string | undefined, uri: string): string {
  const ext = (format ?? uri.split('.').pop() ?? '').toLowerCase();
  return ext === 'png' ? 'image/png' : 'image/jpeg';
}
