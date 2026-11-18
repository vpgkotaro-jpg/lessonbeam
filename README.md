# LessonBeam

**Lessons that travel without internet.** Pack a lesson (text plus an optional quiz) into a looping sequence of QR codes, hold the screen up to another phone or laptop, and the second device rebuilds the lesson, verifies it, lets the learner take the quiz, and can beam it onward to the next person.

- Live app: https://vpgkotaro-jpg.github.io/lessonbeam/
- Built for **Bridge The Gap Hacks** (theme: expanding access to technology regardless of location).
- Static site: no build step, no backend, no accounts, no analytics, no CDN. After the first load it works fully offline (service worker + web app manifest, installable as a PWA).

## Why

Many learners have a phone or an old laptop but no reliable internet at home. A teacher or a classmate who *does* have a lesson often cannot share it without a connection, a messaging app or a paired device. LessonBeam uses the one channel every smartphone already has: a screen and a camera. One device shows the lesson as light; the other reads it. Because the same app can re-beam what it received, a single download in a connected place can spread peer to peer through a classroom or village.

This README deliberately cites no statistics about the access gap; none were gathered for this project.

## How it works

1. **Pack.** The lesson JSON (`title`, `text` up to 6,000 characters, optional quiz of up to 5 multiple-choice questions) is gzip-compressed with the browser's `CompressionStream` (uncompressed fallback if unsupported or if it would not shrink).
2. **Frame.** The packed bytes are split into base64url chunks (default 300 characters, adjustable 150 to 400). Each chunk becomes one frame:

   ```
   LB1|<transferId>|<index>|<total>|<crc32 of payload, 8 hex>|<payload>
   ```

   `transferId` is the first 8 hex characters of the SHA-256 of the packed bytes. Frame `0` is a header frame whose payload is `<gzip 0|1>.<byteLength>.<sha256 hex>`; frames `1..total-1` carry data.
3. **Beam.** Each frame is rendered as a QR code (error correction L, one common QR size for every frame) on a canvas, looping at 2 to 10 frames per second. The UI shows the frame number, pass number and estimated loop time.
4. **Receive.** `getUserMedia` plus a jsQR scan loop reads frames in any order and from any point in the loop. Every frame is checked against its CRC-32; a progress grid shows which parts have arrived.
5. **Verify.** When all parts are present the lesson is reassembled, its length checked and its **SHA-256 verified via `SubtleCrypto`**. A mismatch is rejected and reported; nothing is saved. Only then is it decompressed, validated and stored in `localStorage`.
6. **Use and re-beam.** Read the lesson, take the quiz (scored locally), and press *Beam this lesson onward*.

All lesson text is rendered with `textContent`, and a strict Content-Security-Policy (`default-src 'self'`, no inline script or style, `connect-src 'self'`) is set in the page.

### Loopback self-test

The Beam tab has a **self-test** that reads the pixels of the sender's QR canvas in the same page, so the whole pipeline (pack, QR render, QR decode, CRC, SHA-256, save) can be seen without a camera or a second device. It is a loopback test and says so in the UI. It does not exercise a physical camera.

## Run locally

Any static file server works (camera and `SubtleCrypto` need `https:` or `localhost`):

```
npx serve .          # or: python3 -m http.server 8000
```

Then open http://localhost:8000/. There is nothing to build.

## Testing performed

Automated with Playwright (Chromium) during development: create lesson, beam, loopback receive, hash verified, quiz scored, lesson in library; tampered payload with a valid CRC is rejected by the SHA-256 check; corrupted frame is rejected by CRC; the denied/absent camera shows an error message; reload with the network switched off still works and the self-test passes offline; and a receive through Chromium's *fake video capture device* fed with recorded sender frames (a simulated camera, not a real phone) reassembles, verifies and saves a lesson. No console errors were observed in these runs.

## Limitations

- **Not tested on real phones in real rooms.** Camera reading was only tested with Chromium's fake capture device. Glare, distance, focus and screen refresh effects on real hardware are untested. Expect to adjust frame size and speed (smaller frames and slower speed are easier to read).
- No users, pilots or classroom trials have taken place; this is a hackathon prototype.
- Lessons are limited to text and simple multiple-choice quizzes (6,000 characters of text, 5 questions); no images or audio.
- Throughput is low by nature (roughly 200 to 400 bytes per frame): a full text lesson takes seconds, not a large file.
- There is no encryption or sender authentication. The hash detects corruption, not a malicious sender; anyone who can see the screen can read the lesson.
- Requires a browser with `getUserMedia` and `SubtleCrypto` (current Chrome, Edge, Safari, Firefox). Gzip needs `CompressionStream`/`DecompressionStream`; without it lessons are sent uncompressed (receiving a gzip lesson on such a browser fails with a clear message).
- `localStorage` is per browser and can be cleared by the user or the browser.

## Third-party software

| Library | Version | License | File |
| --- | --- | --- | --- |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | 2.0.4 | MIT | `js/vendor/qrcode.js`, `licenses/qrcode-generator-LICENSE.txt` |
| [jsQR](https://github.com/cozmo/jsQR) | 1.4.0 | Apache-2.0 | `js/vendor/jsQR.js`, `licenses/jsQR-LICENSE.txt` |

"QR Code" is a registered trademark of DENSO WAVE INCORPORATED.

## AI assistance

Built with help from Claude (Anthropic) as an AI coding assistant; design decisions and testing by the author.

## Author and license

Kotaro Kurosaki. MIT License, see `LICENSE`. The two sample lessons are original text written for this project.
