// Generates audio scripts through the app's real writeScript and measures repetition. Needs the Gemini key.
import { readFileSync, writeFileSync } from 'fs';
for (const l of readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^"|"$/g,''); }
const P = [
 'Glycolysis is the first stage of cellular respiration. It takes place in the cytoplasm and does not need oxygen. One molecule of glucose is split into two molecules of pyruvate. The process uses two ATP at the start and makes four ATP, so the net gain is two ATP. It also produces two NADH, which carry electrons to a later stage.',
 'The link reaction happens when oxygen is present. Each pyruvate enters the mitochondrion and is converted to acetyl coenzyme A. Carbon dioxide is released and one NADH is made for each pyruvate. Acetyl coenzyme A is the molecule that enters the Krebs cycle.',
 'The Krebs cycle takes place in the mitochondrial matrix. Acetyl coenzyme A combines with oxaloacetate to form citrate. Over a series of steps the citrate is broken down again, releasing two molecules of carbon dioxide per turn. Each turn produces three NADH, one FADH2 and one ATP. Because one glucose gives two acetyl groups, the cycle turns twice per glucose.',
 'Oxidative phosphorylation happens on the inner mitochondrial membrane. NADH and FADH2 give up their electrons to the electron transport chain. As electrons move along the chain, protons are pumped into the space between the membranes. The protons flow back through ATP synthase, which drives the making of ATP. Oxygen is the final electron acceptor and combines with protons to form water.',
 'In total, one glucose molecule can yield about thirty to thirty-two ATP. Most of this comes from oxidative phosphorylation. Without oxygen, cells rely on fermentation, which regenerates NAD plus so glycolysis can continue but yields only two ATP per glucose. In animals the product of fermentation is lactate; in yeast it is ethanol and carbon dioxide.',
 'Respiration is regulated by the needs of the cell. When ATP is plentiful, it slows the enzyme phosphofructokinase in glycolysis. When ATP is low and ADP is high, the enzyme speeds up. This feedback keeps the supply of energy matched to demand and prevents the cell wasting glucose.',
];
const SHORT = P[0];
const MEDIUM = P.join('\n\n');
async function main(){
  const { writeScript } = await import('../../lib/audio/script');
  const { measureRepetition } = await import('../../lib/audio/repetition');
  const cases = (process.argv[2]||'short5:walkthrough,med10:walkthrough,med10:rapid,med10:quiz').split(',').map(x=>x.split(':'));
  const out:any[]=[];
  for(const [key,format] of cases){
    const text = key.startsWith('short')?SHORT:MEDIUM; const tier = Number(key.replace(/\D/g,'')) as 5|10|15;
    const t0=Date.now();
    try{
      const r:any = await writeScript({ name:'Cell respiration', text, format: format as any, goal:'learn', tier });
      if(!r){console.log(key,format,'no script');continue}
      const m=measureRepetition(r.script.turns,text);
      out.push({key,format,min:r.minutes,repaired:r.repaired,...m,turnsText:r.script.turns.map((t:any)=>t.text)});
      const f=(n:number)=>n.toFixed(3);
      console.log(`${key.padEnd(8)} ${format.padEnd(12)} ${String(r.minutes).padStart(5)}min repaired=${r.repaired} words ${m.words} stretch x${m.stretch?.toFixed(1)} sentRepeat ${f(m.repeatedSentenceRate)} 6gram ${f(m.repeatedSixGramRate)} nearDup ${m.nearDuplicateTurns} variety ${f(m.vocabularyVariety)}  (${Math.round((Date.now()-t0)/1000)}s)`);
    }catch(e){console.log(key,format,'FAILED',String(e).slice(0,120))}
  }
  writeFileSync(process.argv[3]||'tests/bots/reports/audio-experiment.json',JSON.stringify(out,null,1));
  process.exit(0);
}
main();
