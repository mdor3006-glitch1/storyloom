const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];

/**
 * Face detection stub.
 * TODO (Task 2.3): Replace with real detection — either call backend
 * POST /validate-face with the image URI, or wire in a native ML Kit
 * face detector (e.g. @react-native-ml-kit/face-detection).
 * Until then this always passes so the UI flow is testable end-to-end.
 */
export async function detectFaceInImage(_uri: string): Promise<boolean> {
  await new Promise((resolve) => setTimeout(resolve, 1400)); // simulate detection delay
  return true;
}

export function validateImageFile(fileSize: number, mimeType: string): { valid: boolean; error?: string } {
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'upload_size' };
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return { valid: false, error: 'upload_format' };
  }
  return { valid: true };
}

export function getSceneImageAspectRatio(): { width: number; height: number } {
  return { width: 16, height: 9 };
}
