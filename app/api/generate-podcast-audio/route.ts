// app/api/generate-podcast-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
const PODCAST_BUCKET_NAME = 'podcasts';

interface AudioRequest {
  script: string;
}

async function textToSpeech(text: string, voiceId: string): Promise<Buffer> {
    const audioStream = await elevenlabs.textToSpeech.stream(
        voiceId,
        {
            text: text,
            modelId: "eleven_multilingual_v2"
        }
    );

    const reader = audioStream.getReader();
    const chunks: Uint8Array[] = [];

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
    }

    return Buffer.concat(chunks);
}

export async function POST(req: NextRequest) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffmpegStatic = require('ffmpeg-static');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ffprobe = require('ffprobe-static');

    if (!ffmpegStatic) {
        return NextResponse.json({ error: "ffmpeg-static not found on the server." }, { status: 500 });
    }
    ffmpeg.setFfmpegPath(ffmpegStatic);

    if (!ffprobe || !ffprobe.path) {
        return NextResponse.json({ error: "ffprobe-static not found on the server." }, { status: 500 });
    }
    ffmpeg.setFfprobePath(ffprobe.path);

    if (!process.env.ELEVENLABS_API_KEY || !process.env.VOICE_1_ID || !process.env.VOICE_2_ID) {
        return NextResponse.json({ error: 'TTS service is not configured.' }, { status: 500 });
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-'));

    try {
        const body = await req.json() as AudioRequest;
        const { script } = body;
        const lines = script.split('\n').filter(line => line.trim() !== '');
        const audioFilePaths: string[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let voiceId = process.env.VOICE_1_ID!;
            let textToSpeak = line;

            if (line.startsWith('[HOST A]:')) {
                voiceId = process.env.VOICE_1_ID!;
                textToSpeak = line.replace('[HOST A]:', '').trim();
            } else if (line.startsWith('[HOST B]:')) {
                voiceId = process.env.VOICE_2_ID!;
                textToSpeak = line.replace('[HOST B]:', '').trim();
            }
            
            if (textToSpeak) {
              const audioBuffer = await textToSpeech(textToSpeak, voiceId);
              const tempFilePath = path.join(tempDir, `segment-${i}.mp3`);
              fs.writeFileSync(tempFilePath, audioBuffer);
              audioFilePaths.push(tempFilePath);
            }
        }

        if (audioFilePaths.length === 0) {
            throw new Error("No audio could be generated from the provided script.");
        }

        const finalPodcastPath = path.join(tempDir, 'final-podcast.mp3');

        await new Promise<void>((resolve, reject) => {
            const command = ffmpeg();
            audioFilePaths.forEach(filePath => {
                command.input(filePath);
            });
            command
                .on('error', (err) => reject(new Error(`FFMPEG error: ${err.message}`)))
                .on('end', () => resolve())
                .mergeToFile(finalPodcastPath, tempDir);
        });

        const finalPodcastBuffer = fs.readFileSync(finalPodcastPath);
        const uniqueFileName = `${userId}/${nanoid()}.mp3`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from(PODCAST_BUCKET_NAME)
            .upload(uniqueFileName, finalPodcastBuffer, {
                contentType: 'audio/mpeg',
                upsert: false,
            });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabaseAdmin.storage.from(PODCAST_BUCKET_NAME).getPublicUrl(uploadData.path);
        
        return NextResponse.json({ podcastUrl: publicUrlData.publicUrl }, { status: 200 });

    } catch (error) {
        console.error('Error generating podcast audio:', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
}