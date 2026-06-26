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

    let name = "YouTube Video";
    try {
      const oembed = await fetch('https://www.youtube.com/oembed?url=' + url + '&format=json');
      const oembedData = await oembed.json();
      if (oembedData.title) {
        name = oembedData.title;
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
