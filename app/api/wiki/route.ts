import { NextResponse } from 'next/server';

export interface Wiki {
  id: number;
  name: string;
  slug: string;
  domain: string;
  path: string;
  language: string;
  owner_user_id: number;
  owner_username: string;
  visibility: 'public' | 'private' | 'unlisted';
  status: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
  }

  try {
    const apiRes = await fetch(
      `${process.env.BACKEND_URL}/api/v1/users/${userId}/wikis`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      }
    );

    if (!apiRes.ok) {
      const text = await apiRes.text();
      return NextResponse.json({ error: `Backend error: ${text}` }, { status: apiRes.status });
    }

    const data = await apiRes.json();
    return NextResponse.json({ wikis: data.wikis as Wiki[] }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
