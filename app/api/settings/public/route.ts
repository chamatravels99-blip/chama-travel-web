import { NextResponse } from 'next/server';
import { getServerSiteSettings } from '@/lib/server/site-settings';
import { DEFAULT_PUBLIC_SITE_SETTINGS, toPublicSiteSettings } from '@/lib/site-settings';

export async function GET() {
  try {
    const settings = await getServerSiteSettings();
    return NextResponse.json(
      {
        success: true,
        data: toPublicSiteSettings(settings),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('Public site settings could not be loaded.', error);
    return NextResponse.json(
      {
        success: true,
        data: DEFAULT_PUBLIC_SITE_SETTINGS,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}
