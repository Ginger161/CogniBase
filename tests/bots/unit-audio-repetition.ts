import { readFileSync } from 'fs';
import { assert, finish, group, test } from './harness';
import { audioPrompt, normaliseScript } from '../../lib/audio/script';
import { isEcho, measureRepetition } from '../../lib/audio/repetition';
import { FORMAT_INFO } from '../../lib/audio/formats';

const fixture: string[] = JSON.parse(readFileSync('tests/bots/fixtures/rapid-looping-turns.json', 'utf8'));
const asTurns = (texts: string[]) => texts.map((text, i) => ({ speaker: i % 2 ? 'B' : 'A', text }));

group('Audio scripts must not repeat themselves');
(async () => {
  await test('the prompt no longer tells the model to say definitions twice, and forbids repeating', async () => {
    const p = audioPrompt({ name: 'X', text: 'Some source text about cells and energy in the body.', format: 'walkthrough', goal: 'learn', tier: 10 });
    assert(!/same words at least twice/i.test(p), 'still asks for definitions twice');
    assert(/NEVER REPEAT/.test(p), 'missing the no-repeat rules');
    assert(/shorter episode is better/i.test(p), 'does not allow finishing early when the source runs out');
  });
  await test('no format tells one host to repeat the other', async () => {
    for (const [k, v] of Object.entries(FORMAT_INFO)) assert(!/repeated back|immediately repeat/i.test(v.structure), `${k} still asks for an echo`);
  });
  await test('an exact echo of the previous turn is spotted; a new point is not', async () => {
    const prev = [{ text: 'The Krebs cycle takes place in the mitochondrial matrix where acetyl coenzyme A joins oxaloacetate.' }];
    assert(isEcho('So the Krebs cycle takes place in the mitochondrial matrix where acetyl coenzyme A joins oxaloacetate!', prev), 'echo missed');
    assert(!isEcho('Each turn of the cycle makes three NADH, one FADH two and one ATP, so remember that count.', prev), 'new point flagged');
  });
  await test('a recall question and its short answer are never treated as an echo', async () => {
    const raw = {
      title: 't',
      chapters: [{ title: 'Intro', startTurn: 0 }],
      turns: [
        { speaker: 'A', text: 'The link reaction converts pyruvate into acetyl coenzyme A inside the mitochondrion, releasing carbon dioxide.' },
        { speaker: 'B', text: 'What does pyruvate become in the link reaction inside the mitochondrion?', recall: true },
        { speaker: 'A', text: 'Acetyl coenzyme A, and carbon dioxide is released along the way.' },
        { speaker: 'B', text: 'Nice, and where does that acetyl coenzyme A go next?' },
        { speaker: 'A', text: 'Into the Krebs cycle, in the mitochondrial matrix.' },
      ],
    };
    const out = normaliseScript(raw, 'x')!;
    assert(out.turns.length === 5, `kept ${out.turns.length} of 5`);
    assert(out.turns[1].recall === true, 'recall flag lost');
  });
  await test('the real looping Rapid-fire script from the baseline loses its echoes', async () => {
    const before = measureRepetition(asTurns(fixture) as never);
    const out = normaliseScript({ title: 't', chapters: [], turns: asTurns(fixture) }, 'x')!;
    const after = measureRepetition(out.turns);
    assert(before.nearDuplicateTurns >= 10, `fixture is not looping (${before.nearDuplicateTurns})`);
    assert(after.nearDuplicateTurns <= 3, `near-duplicate turns left: ${after.nearDuplicateTurns}`);
    assert(after.repeatedSixGramRate < 0.1, `repeated phrases ${after.repeatedSixGramRate.toFixed(3)}`);
    assert(!out.turns.some((t) => /say that core definition again|repeat that key definition/i.test(t.text)), 'a "say it again" turn survived');
    return `near-duplicates ${before.nearDuplicateTurns} → ${after.nearDuplicateTurns}, repeated phrases ${(before.repeatedSixGramRate * 100).toFixed(0)}% → ${(after.repeatedSixGramRate * 100).toFixed(0)}%`;
  });
  await test('chapters still point at the right turn after echoes are removed', async () => {
    const raw = {
      title: 't',
      chapters: [{ title: 'Intro', startTurn: 0 }, { title: 'Second topic', startTurn: 4 }],
      turns: [
        { speaker: 'A', text: 'Glycolysis splits one glucose molecule into two pyruvate molecules in the cytoplasm.' },
        { speaker: 'B', text: 'So glycolysis splits one glucose molecule into two pyruvate molecules in the cytoplasm!' },
        { speaker: 'A', text: 'It nets two ATP and two NADH, which matters for the exam.' },
        { speaker: 'B', text: 'Got it, now what comes after that stage?' },
        { speaker: 'A', text: 'The Krebs cycle begins here with citrate formation, inside the mitochondrial matrix.' },
        { speaker: 'B', text: 'And that is where carbon dioxide gets released, right?' },
      ],
    };
    const out = normaliseScript(raw, 'x')!;
    const second = out.chapters.find((c) => c.title === 'Second topic')!;
    assert(/Krebs cycle begins/.test(out.turns[second.startTurn].text), `chapter starts at "${out.turns[second.startTurn]?.text}"`);
  });
  process.exit(finish('unit-audio-repetition') ? 1 : 0);
})();
