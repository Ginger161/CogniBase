// Baseline: how repetitive are the audio scripts already saved in the database?
import { readFileSync } from 'fs';
import pg from 'pg';
import { measureRepetition } from '../../lib/audio/repetition';
for (const l of readFileSync('.env.local','utf8').split(/\r?\n/)) { const m=l.match(/^([A-Z_]+)=(.*)$/); if(m) process.env[m[1]]=m[2].replace(/^"|"$/g,''); }
(async()=>{
  const c=new pg.Client({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:20000}); await c.connect();
  const r=await c.query(`select s.title, s.content, d."textContent" as src from "StudioAsset" s left join "Document" d on d.id = s.content->>'documentId' where s.type='AUDIO' order by s."createdAt" desc limit 20`);
  const f=(n:number)=>n.toFixed(3);
  for(const row of r.rows){
    const m=measureRepetition(row.content.turns,row.src||undefined);
    console.log(`${String(row.content.format).padEnd(12)} ${String(row.content.minutes).padStart(4)}min  words ${String(m.words).padStart(5)}  src→script x${m.stretch?m.stretch.toFixed(1):'?'}  sentRepeat ${f(m.repeatedSentenceRate)}  6gramRepeat ${f(m.repeatedSixGramRate)}  nearDupTurns ${m.nearDuplicateTurns}  variety ${f(m.vocabularyVariety)}`);
  }
  await c.end();
})().catch(e=>console.log('ERR',String(e)));
