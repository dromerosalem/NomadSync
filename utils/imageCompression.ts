
import imageCompression from 'browser-image-compression';

/**
 * Compresses an image file to a target size of ~200KB.
 * - Max Width/Height: 1024px
 * - Max Size: 0.2MB
 * - Use WebWorker: true
 */
export const compressImage = async (imageFile: File): Promise<File> => {
    // 1. If it's a PDF, don't touch it.
    if (imageFile.type === 'application/pdf') {
        return imageFile;
    }

    // 2. Options for compression
    const options = {
        maxSizeMB: 0.2,          // 200KB target
        maxWidthOrHeight: 1024,  // 1024px max dimension (good for receipt text)
        useWebWorker: true,
        fileType: 'image/jpeg'   // Output as JPEG for consistency
    };

    try {
        console.log(`[ImageCompression] Original size: ${(imageFile.size / 1024 / 1024).toFixed(2)} MB`);
        const compressedFile = await imageCompression(imageFile, options);
        console.log(`[ImageCompression] Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
        return compressedFile;
    } catch (error) {
        console.error('[ImageCompression] Error:', error);
        return imageFile; // Return original if compression fails
    }
};
