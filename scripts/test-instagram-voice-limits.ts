import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import {
  MAX_INSTAGRAM_VOICE_SECONDS,
  MAX_INSTAGRAM_VOICE_BYTES,
  assertInstagramVoiceDuration,
  normalizeInstagramAudio,
  validateInstagramVoiceBuffer,
} from "../src/lib/instagram/audio-normalizer";

async function main(){
 assert.equal(MAX_INSTAGRAM_VOICE_SECONDS,300);
 assert(MAX_INSTAGRAM_VOICE_BYTES < 25_000_000);
 assert.doesNotThrow(()=>assertInstagramVoiceDuration(60.8));
 assert.doesNotThrow(()=>assertInstagramVoiceDuration(299.99));
 assert.doesNotThrow(()=>assertInstagramVoiceDuration(300));
 assert.throws(()=>assertInstagramVoiceDuration(300.8),/۵ دقیقه/);
 assert.throws(()=>assertInstagramVoiceDuration(600),/۵ دقیقه/);
 assert.throws(()=>assertInstagramVoiceDuration(Number.NaN),/قابل تشخیص/);
 assert(ffmpegPath);
 const dir=await mkdtemp(path.join(os.tmpdir(),"daira-voice-limits-"));
 try{
  const valid=path.join(dir,"voice-299.wav"), invalid=path.join(dir,"voice-301.wav");
  for(const [dest,seconds] of [[valid,299],[invalid,301]] as const){
   execFileSync(ffmpegPath!,["-hide_banner","-loglevel","error","-y","-f","lavfi","-i","sine=frequency=440:sample_rate=16000","-t",String(seconds),"-ac","1",dest],{timeout:30000});
  }
  const good=await readFile(valid),bad=await readFile(invalid);
  await validateInstagramVoiceBuffer(good,"voice-299.wav");
  await assert.rejects(()=>validateInstagramVoiceBuffer(bad,"voice-301.wav"),/۵ دقیقه/);
  await assert.rejects(()=>normalizeInstagramAudio(bad,"voice-301.wav"),/۵ دقیقه/);
  const normalized=await normalizeInstagramAudio(good,"voice-299.wav");
  assert(normalized.length>100&&normalized.length<25_000_000);
  assert.equal(normalized.subarray(4,8).toString("ascii"),"ftyp");
  await validateInstagramVoiceBuffer(normalized,"voice-299.m4a");
  await assert.rejects(()=>validateInstagramVoiceBuffer(Buffer.alloc(25_000_000),"too-big.wav"),/۲۵ مگابایت/);
 }finally{await rm(dir,{recursive:true,force:true});}
 console.log("INSTAGRAM_VOICE_DURATION_SIZE_ENFORCEMENT_OK");
}
main().catch(err=>{console.error(err);process.exitCode=1;});
