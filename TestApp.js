import express from 'express';
import { WebSocketServer } from 'ws';
import twilio from 'twilio';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import wavefile from 'wavefile';
import { Readable } from 'stream';
import fs, { openSync, writeSync, createWriteStream } from "fs";
import lamejs from 'lamejs';

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const server = createServer(app);

const wss = new WebSocketServer({ server });

function decodeMuLawSample(muLaw) {
    muLaw = ~muLaw;
    const sign = muLaw & 0x80;
    let exponent = (muLaw & 0x70) >> 4;
    const mantissa = muLaw & 0x0F;
    let sample = (1 << 7) | (mantissa << 4) | (1 << 3);
    sample <<= exponent + 2;

    if (exponent !== 0) {
        sample += 1 << (exponent + 2);
    }

    return (sign ? -sample : sample) / 32768.0;
}

function decodeMuLaw(encoded) {
    const buffer = decodeBase64(encoded);
    const dataView = new DataView(buffer);
    const samples = new Float32Array(buffer.byteLength);

    for (let i = 0; i < buffer.byteLength; i++) {
        const mulawByte = dataView.getInt8(i, true);
        samples[i] = decodeMuLawSample(mulawByte);
    }

    return samples;
}

function decodeBase64(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function encodeMuLawSample(sample) {
    const sign = (sample >= 0) ? 0 : 0x80;
    sample = Math.min(1.0, Math.abs(sample));
    let exponent = Math.floor(Math.log(sample) / Math.log(1.0 / 0x10));
    const mantissa = Math.floor((sample * (1 << (exponent + 3))) - (1 << exponent));

    exponent = Math.min(exponent, 0x0F);

    const muLawSample = ~(sign | (exponent << 4) | mantissa);
    return muLawSample & 0xFF;
}

function encodeMuLaw(samples) {
    const encodedSamples = new Uint8Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
        encodedSamples[i] = encodeMuLawSample(samples[i]);
    }

    const binaryString = String.fromCharCode.apply(null, encodedSamples);
    return btoa(binaryString);
}

let audioStart = false
const pcmData = []
const sentAudio = []
const recievedAudio =[]

wss.on('connection', ws => {
    console.log('new connection');

    let receivedAudioBuffer = Buffer.alloc(0); 
    const header =  Buffer.from([
        0x52,
        0x49,
        0x46,
        0x46,
        0x62,
        0xb8,
        0x00,
        0x00,
        0x57,
        0x41,
        0x56,
        0x45,
        0x66,
        0x6d,
        0x74,
        0x20,
        0x12,
        0x00,
        0x00,
        0x00,
        0x07,
        0x00,
        0x01,
        0x00,
        0x40,
        0x1f,
        0x00,
        0x00,
        0x80,
        0x3e,
        0x00,
        0x00,
        0x02,
        0x00,
        0x04,
        0x00,
        0x00,
        0x00,
        0x66,
        0x61,
        0x63,
        0x74,
        0x04,
        0x00,
        0x00,
        0x00,
        0xc5,
        0x5b,
        0x00,
        0x00,
        0x64,
        0x61,
        0x74,
        0x61,
        0x00,
        0x00,
        0x00,
        0x00, // Those last 4 bytes are the data length
    ])
    receivedAudioBuffer = Buffer.concat([receivedAudioBuffer, header]);

    const wstream = createWriteStream("audio_test.wav", {
        encoding: "binary",
    });
    wstream.write(
        Buffer.from([
          0x52,
          0x49,
          0x46,
          0x46,
          0x62,
          0xb8,
          0x00,
          0x00,
          0x57,
          0x41,
          0x56,
          0x45,
          0x66,
          0x6d,
          0x74,
          0x20,
          0x12,
          0x00,
          0x00,
          0x00,
          0x07,
          0x00,
          0x01,
          0x00,
          0x40,
          0x1f,
          0x00,
          0x00,
          0x80,
          0x3e,
          0x00,
          0x00,
          0x02,
          0x00,
          0x04,
          0x00,
          0x00,
          0x00,
          0x66,
          0x61,
          0x63,
          0x74,
          0x04,
          0x00,
          0x00,
          0x00,
          0xc5,
          0x5b,
          0x00,
          0x00,
          0x64,
          0x61,
          0x74,
          0x61,
          0x00,
          0x00,
          0x00,
          0x00, // Those last 4 bytes are the data length
        ])
    );


    ws.on('message', message => {
        const msg = JSON.parse(message);
        switch (msg.event) {
            case 'connected':
                console.log('Connected');
                break;
            case 'start':
                console.log('Starting media Stream');
                break;
            case 'media':
                const decodedAudioSamples = decodeMuLaw(msg.media.payload);
                // Check if someone is speaking

                if (decodedAudioSamples.some(sample => Math.abs(sample) > 0.1 )) { // threshold 0.1
                    wstream.write(Buffer.from(msg.media.payload, "base64"));
                    const audioPayloadBuffer = Buffer.from(msg.media.payload, "base64");
                    receivedAudioBuffer = Buffer.concat([receivedAudioBuffer, audioPayloadBuffer]);
                    recievedAudio.push(msg.media.payload)
                    console.log("Someone is speaking!");

                    audioStart = true
                } else {
                    if(audioStart){
                        const payload = encodeMuLaw(pcmData)
                        sentAudio.push(payload)

                        // console.log("ENCODED", payload)
                        // ws.send(JSON.stringify({ 
                        //     event: 'media',
                        //     streamSid: msg.streamSid, 
                        //     media: {
                        //         payload
                        //     } 
                        // }));
                        console.log("WE SENT")
                    }
                    audioStart = false
                }
                break;
            case 'mark':
                console.log("no idea but", msg)
                break;
            case 'stop':
                wstream.write("", () => {
                    let fd = openSync(wstream.path, "r+"); // `r+` mode is needed in order to write to arbitrary position
                    let count = wstream.bytesWritten;
                    count -= 58; // The header itself is 58 bytes long and we only want the data byte length
                    writeSync(
                      fd,
                      Buffer.from([
                        count % 256,
                        (count >> 8) % 256,
                        (count >> 16) % 256,
                        (count >> 24) % 256,
                      ]),
                      0,
                      4, // Write 4 bytes
                      54 // starts writing at byte 54 in the file
                    );
                });

                lamejs.setOutputBitrate(128); // Set MP3 bitrate
                lamejs.setMode(lamejs.MONO); // Set MP3 mode (MONO or STEREO)
                lamejs.init();

                fs.createReadStream("audio_test.wav")
                    .pipe(lamejs.encoder())
                    .pipe(fs.createWriteStream("audio_test.mp3"))
                    .on('finish', () => {
                    // Access the MP3 binary data as a Buffer
                    const mp3Data = fs.readFileSync("audio_test.mp3");
                    console.log("MP3 data stored in variable:", mp3Data);

                    // Perform any actions with the MP3 data here

                    // Clean up the WAV file (optional)
                    fs.unlinkSync("audio_test.wav");
                    });
                console.log('STOPPED');
                // console.log("RECIEVED", recievedAudio)
                // console.log("SENT BACK", sentAudio)
                break;
        }
    });
});

app.post('/call', (req, res) => {
    res.set('Content-Type', 'text/xml');
    const twiml = new twilio.twiml.VoiceResponse();
    res.send(
        `<Response>
            <Connect>
                <Stream url="wss://${req.headers.host}"/>
            </Connect>
            <Say>hi i am bob</Say>
            <Pause length="60"/>
        </Response>`
        );
        
});

server.listen(5000, () => {
    console.log('Server listening on port 5000');
});
