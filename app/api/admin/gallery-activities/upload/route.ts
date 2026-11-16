import { NextResponse } from 'next/server';
import { authorizationResponse, isSameOriginRequest, requireRoles } from '@/lib/server/authorization';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const ALLOWED_FOLDERS = new Set(['gallery', 'activities']);
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Server-side fallback upload into website-assets/{gallery|activities}/... */
export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return NextResponse.json({ success: false, error: 'Request origin is not allowed.' }, { status: 403 });
    }
    const { supabase } = await requireRoles(['admin', 'super_admin']);

    const formData = await request.formData();
    const file = formData.get('file');
    const folderRaw = formData.get('folder');
    const folder = typeof folderRaw === 'string' && ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : null;

    if (!folder) {
      return NextResponse.json({ success: false, error: 'Invalid upload folder.' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'Select an image file to upload.' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported image format. Use JPG, PNG, WebP, GIF, or AVIF.' },
        { status: 400 }
      );
    }
    if (file.size <= 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, error: 'Image file size must be under 10 MB.' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const baseName =
      file.name
        .replace(/\.[^/.]+$/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'image';
    const storagePath = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${baseName}.${ext}`;

    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from('website-assets')
      .upload(storagePath, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('Gallery/activity image upload failed.', uploadError.message);
      return NextResponse.json({ success: false, error: 'Image could not be uploaded to storage.' }, { status: 409 });
    }

    const { data: publicUrlData } = supabase.storage.from('website-assets').getPublicUrl(storagePath);
    return NextResponse.json({ success: true, data: { path: storagePath, publicUrl: publicUrlData.publicUrl } });
  } catch (error) {
    return authorizationResponse(error);
  }
}
