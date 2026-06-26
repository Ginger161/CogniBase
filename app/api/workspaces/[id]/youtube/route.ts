import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { YoutubeTranscript } from 'youtube-transcript';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workspaceId } = await params;
    const { url } = await req.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: "Missing or invalid URL" }, { status: 400 });
    }

    // Extract video ID from URL for the name
    const videoIdMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11}).*/);
    const videoId = videoIdMatch ? videoIdMatch[1] : 'Unknown';
    let name = `YouTube Video: ${videoId}`;

    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${url}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        if (oembedData.title) name = oembedData.title;
      }
    } catch (e) {
      console.warn("Failed to fetch YouTube title:", e);
    }

    // Fetch the transcript
    let transcriptItems;
    try {
      transcriptItems = await YoutubeTranscript.fetchTranscript(url);
    } catch (fetchError) {
      return NextResponse.json({ 
        error: "No transcript or captions are available for this video. Possible reasons include: The creator disabled captions, there is no speech in the video, the video is age-restricted or private, or it is an active live stream."
      }, { status: 400 });
    }

    const transcriptText = transcriptItems.map(item => item.text).join(' ');

    // Save to the database
    const newDoc = await prisma.document.create({
      data: {
        name,
        url,
        workspaceId,
        sourceType: "youtube",
        textContent: transcriptText
      }
    });

    return NextResponse.json(newDoc);
  } catch (error) {
    console.error("YouTube Transcriber Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to transcribe YouTube video";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
