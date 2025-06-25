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
import { promisify } from 'util';
import stream from 'stream';

const pipeline = promisify(stream.pipeline);

/**
 * Checks for a binary in the /tmp folder. If it doesn't exist, downloads it
 * from the provided URL and makes it executable.
 * @param {string} name - The name of the binary (e.g., 'ffmpeg').
 * @param {string} url - The public URL to download the binary from.
 * @returns {Promise<string>} The path to the executable binary in /tmp.
 */
const ensureBinary = async (name: string, url: string): Promise<string> => {
    const binaryPath = path.join(os.tmpdir(), name);
    try {
        await fs.promises.access(binaryPath, fs.constants.X_OK);
        return binaryPath; // It exists and is executable
    } catch (e) {
        // It doesn't exist or isn't executable, so download it
        const response = await fetch(url);
        if (!response.ok || !response.body) {
            throw new Error(`Failed to download ${name}: ${response.statusText}`);
        }
        await pipeline(response.body, fs.createWriteStream(binaryPath));
        await fs.promises.chmod(binaryPath, '755'); // Make it executable
        return binaryPath;
    }
};

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
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'podcast-'));
    try {
        const ffmpegUrl = process.env.FFMPEG_BINARY_URL;
        const ffprobeUrl = process.env.FFPROBE_BINARY_URL;
        if (!ffmpegUrl || !ffprobeUrl) {
            return NextResponse.json({ error: "FFmpeg/FFprobe binary URLs not configured." }, { status: 500 });
        }
        
        const [ffmpegPath, ffprobePath] = await Promise.all([
            ensureBinary('ffmpeg', ffmpegUrl),
            ensureBinary('ffprobe', ffprobeUrl)
        ]);
        
        ffmpeg.setFfmpegPath(ffmpegPath);
        ffmpeg.setFfprobePath(ffprobePath);

        if (!process.env.ELEVENLABS_API_KEY || !process.env.VOICE_1_ID || !process.env.VOICE_2_ID) {
            return NextResponse.json({ error: 'TTS service is not configured.' }, { status: 500 });
        }

        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = session.user.id;
        
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
            ffmpeg(audioFilePaths[0]) // Start with the first file
                .input(audioFilePaths.slice(1)) // Add the rest as inputs
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