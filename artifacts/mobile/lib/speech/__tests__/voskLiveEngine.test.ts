/**
 * Runs a few synthetic utterances through the real Vosk small models.
 * Skips when the models or the local vosk Python package are not installed.
 * Desktop timings are not phone timings.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { chessPhraseGrammar } from '../voskGrammar.ts';
import { agreeHypotheses, chessInterpretationKey } from '../voskDecision.ts';

const ROOT = process.env.ANYCHESS_VOSK_DIR || '/tmp/asr-proto';
const PYTHON = process.env.ANYCHESS_VOSK_PYTHON || join(ROOT, '.venv/bin/python');
const FR = join(ROOT, 'vosk-model-small-fr-0.22');
const EN = join(ROOT, 'vosk-model-small-en-us-0.15');
const ready = existsSync(PYTHON) && existsSync(FR) && existsSync(EN) && spawnSync('espeak-ng', ['--version']).status === 0;

describe('Vosk live engine', { skip: ready ? false : 'Vosk models or espeak-ng are not installed' }, () => {
  it('transcribes chess phrases and rejects silence with the real models', () => {
    const nf3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    const castle = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const cases = [
      { id: 'fr-knight', lang: 'fr', voice: 'fr', spoken: 'cavalier f3', fen: nf3, grammar: chessPhraseGrammar(nf3, 'fr') },
      { id: 'en-knight', lang: 'en', voice: 'en-us', spoken: 'knight f3', fen: nf3, grammar: chessPhraseGrammar(nf3, 'en') },
      { id: 'fr-castle', lang: 'fr', voice: 'fr', spoken: 'petit roque', fen: castle, grammar: chessPhraseGrammar(castle, 'fr') },
      { id: 'en-castle', lang: 'en', voice: 'en-us', spoken: 'short castle', fen: castle, grammar: chessPhraseGrammar(castle, 'en') },
      { id: 'fr-silence', lang: 'fr', voice: 'fr', spoken: '', fen: nf3, grammar: chessPhraseGrammar(nf3, 'fr'), silence: true },
      { id: 'en-unrelated', lang: 'en', voice: 'en-us', spoken: 'the weather is nice today', fen: nf3, grammar: chessPhraseGrammar(nf3, 'en') },
    ];
    const dir = mkdtempSync(join(tmpdir(), 'vosk-live-'));
    const spec = join(dir, 'cases.json');
    writeFileSync(spec, JSON.stringify({ root: ROOT, dir, cases }));
    const script = `
import json, subprocess, wave
from pathlib import Path
from vosk import Model, KaldiRecognizer, SetLogLevel
SetLogLevel(-1)
spec = json.loads(Path(${JSON.stringify(spec)}).read_text())
root = Path(spec["root"])
models = {
  "fr": Model(str(root / "vosk-model-small-fr-0.22")),
  "en": Model(str(root / "vosk-model-small-en-us-0.15")),
}
out = []
for case in spec["cases"]:
    dest = Path(spec["dir"]) / f"{case['id']}.wav"
    if case.get("silence"):
        subprocess.check_call(["ffmpeg","-y","-loglevel","error","-f","lavfi","-i","anullsrc=r=16000:cl=mono","-t","1.0","-ar","16000","-ac","1",str(dest)])
    else:
        raw = dest.with_suffix(".raw.wav")
        subprocess.check_call(["espeak-ng","-v",case["voice"],"-s","130","-w",str(raw),case["spoken"]], stdout=subprocess.DEVNULL)
        subprocess.check_call(["ffmpeg","-y","-loglevel","error","-i",str(raw),"-ar","16000","-ac","1",str(dest)])
    with wave.open(str(dest)) as handle:
        pcm = handle.readframes(handle.getnframes())
    rec = KaldiRecognizer(models[case["lang"]], 16000, json.dumps(case["grammar"], ensure_ascii=False))
    rec.SetWords(True)
    rec.SetMaxAlternatives(8)
    rec.AcceptWaveform(pcm)
    final = json.loads(rec.FinalResult())
    alts = []
    for alt in final.get("alternatives") or [{"text": final.get("text",""), "confidence": 0}]:
        text = " ".join(w for w in (alt.get("text") or "").split() if w != "[unk]")
        if text:
            alts.append({"text": text, "score": alt.get("confidence") or 0})
    out.append({"id": case["id"], "alts": alts})
print(json.dumps(out))
`;
    const py = spawnSync(PYTHON, ['-c', script], { encoding: 'utf8' });
    assert.equal(py.status, 0, py.stderr);
    const rows = JSON.parse(py.stdout.trim().split('\n').pop() ?? '[]') as { id: string; alts: { text: string; score: number }[] }[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const knightFr = agreeHypotheses(byId.get('fr-knight')!.alts, (text) => chessInterpretationKey(text, nf3, 'fr'));
    assert.equal(knightFr.status, 'accept');
    if (knightFr.status === 'accept') {
      const parsed = chessInterpretationKey(knightFr.text, nf3, 'fr');
      assert.equal(parsed, 'move:Nf3');
    }
    const knightEn = agreeHypotheses(byId.get('en-knight')!.alts, (text) => chessInterpretationKey(text, nf3, 'en'));
    assert.equal(knightEn.status, 'accept');
    if (knightEn.status === 'accept') {
      assert.equal(chessInterpretationKey(knightEn.text, nf3, 'en'), 'move:Nf3');
    }
    const castleFr = agreeHypotheses(byId.get('fr-castle')!.alts, (text) => chessInterpretationKey(text, castle, 'fr'));
    assert.equal(castleFr.status, 'accept');
    if (castleFr.status === 'accept') {
      assert.equal(chessInterpretationKey(castleFr.text, castle, 'fr'), 'move:O-O');
    }
    const silence = agreeHypotheses(byId.get('fr-silence')!.alts, (text) => chessInterpretationKey(text, nf3, 'fr'));
    assert.equal(silence.status, 'reject');
    const unrelated = agreeHypotheses(byId.get('en-unrelated')!.alts, (text) => chessInterpretationKey(text, nf3, 'en'));
    if (unrelated.status === 'accept') {
      assert.equal(chessInterpretationKey(unrelated.text, nf3, 'en').startsWith('move:'), false);
    } else {
      assert.equal(unrelated.status, 'reject');
    }
    assert.ok(new Chess(nf3));
  });
});
