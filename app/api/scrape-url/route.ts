// app/api/scrape-url/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/authOptions';
import * as cheerio from 'cheerio';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ message: 'URL is required.' }, { status: 400 });
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL with status: ${response.status}`);
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const text = $('body').text();
    const cleanText = text.replace(/\s\s+/g, ' ').trim();

    return NextResponse.json({ text: cleanText }, { status: 200 });

  } catch (error) {
    console.error('Error scraping URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return NextResponse.json({ message: 'Failed to scrape URL.', error: errorMessage }, { status: 500 });
  }
}