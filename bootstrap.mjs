import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const urls = [
  "https://d2jqrm6oza8nb6.cloudfront.net/datasets/5ed79de9-ee18-41c1-90b8-454c30394ae1.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiNjk2ZmRlYWI3NTNlYzY3NiIsImJ1Y2tldCI6InJ1bndheS1kYXRhc2V0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5NDM0MDc3OX0.MYD3v6w5JXnpOhR_Q3OMX1MiwrpAMRGZrCMmHQz8kXk",
  "https://d2jqrm6oza8nb6.cloudfront.net/datasets/1aa3227d-ef94-4831-8613-e7c0c487d99b.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiYzQyYTQxM2MzMmUyODFjMCIsImJ1Y2tldCI6InJ1bndheS1kYXRhc2V0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5NDMwOTk0OH0.oM6Uc3-0qMe1ECzzVhN8dlwDV_Z2tiqEAqRfqxE_2tY",
  "https://d2jqrm6oza8nb6.cloudfront.net/datasets/b6813e59-f3bd-48e1-8e42-b86a52f47863.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiNGEzMGYwNWE3NDZjZGQ1YSIsImJ1Y2tldCI6InJ1bndheS1kYXRhc2V0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5NDMxMTY0Mn0.MeYFe-k9f1hM8CVmdP5TiG2oZ0BmEwfs1LV8iUxfNC0",
  "https://d2jqrm6oza8nb6.cloudfront.net/datasets/b8472c94-3562-4cea-96b2-d10f173ea5c8.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiYzQ3YmZjZGRjNTNmNDQwNyIsImJ1Y2tldCI6InJ1bndheS1kYXRhc2V0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5NDMwOTU5N30.1yPSV1kKt5mh0myieOZPjftb-es2CkQwQ61a7BF4i3E",
  "https://d2jqrm6oza8nb6.cloudfront.net/datasets/0fd60208-4957-4720-bcfd-aca7d0b4ceb9.png?_jwt=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJrZXlIYXNoIjoiMzg2ZDk4YzI3ZGU3NDM5NiIsImJ1Y2tldCI6InJ1bndheS1kYXRhc2V0cyIsInN0YWdlIjoicHJvZCIsImV4cCI6MTc5NDM3NzAyNn0.SVhqV32GlAj0LBjmXqr-7QvzUGxrX0shV4CYp0g67Xg"
];
function pngRgb(buf) {
  if (!buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) throw new Error('bad png');
  let p=8,w,h,bd,ct,inter; const ids=[];
  while(p<buf.length){ const n=buf.readUInt32BE(p), t=buf.toString('ascii',p+4,p+8), c=buf.subarray(p+8,p+8+n); p+=12+n;
    if(t==='IHDR'){w=c.readUInt32BE(0);h=c.readUInt32BE(4);bd=c[8];ct=c[9];inter=c[12];}
    else if(t==='IDAT') ids.push(c); else if(t==='IEND') break;
  }
  if(bd!==8||ct!==2||inter!==0) throw new Error('unsupported png');
  const raw=zlib.inflateSync(Buffer.concat(ids)), stride=w*3, out=Buffer.alloc(stride*h), prev=Buffer.alloc(stride); let rp=0,op=0;
  for(let y=0;y<h;y++){ const f=raw[rp++], row=Buffer.from(raw.subarray(rp,rp+stride)); rp+=stride;
    for(let x=0;x<stride;x++){ const a=x>=3?row[x-3]:0,b=prev[x],c=x>=3?prev[x-3]:0; let pr=0;
      if(f===1) pr=a; else if(f===2) pr=b; else if(f===3) pr=Math.floor((a+b)/2); else if(f===4){const q=a+b-c,pa=Math.abs(q-a),pb=Math.abs(q-b),pc=Math.abs(q-c);pr=pa<=pb&&pa<=pc?a:pb<=pc?b:c;} else if(f!==0) throw new Error('png filter');
      row[x]=(row[x]+pr)&255;
    }
    row.copy(out,op); op+=stride; row.copy(prev);
  }
  return out;
}
const parts=[]; let expected,total;
for(let i=0;i<urls.length;i++){ const r=await fetch(urls[i]); if(!r.ok) throw new Error('download '+(i+1)); const b=pngRgb(Buffer.from(await r.arrayBuffer()));
  if(b.toString('ascii',0,8)!=='RWNCARR1') throw new Error('carrier');
  const t=Number(b.readBigUInt64BE(8)), off=Number(b.readBigUInt64BE(16)), idx=b.readUInt32BE(24), count=b.readUInt32BE(28), len=Number(b.readBigUInt64BE(32)), sha=b.subarray(40,72);
  if(i===0){expected=sha;total=t;} if(idx!==i||count!==5||!sha.equals(expected)) throw new Error('carrier meta');
  parts.push([off,b.subarray(128,128+len)]);
}
parts.sort((a,b)=>a[0]-b[0]); const archive=Buffer.concat(parts.map(x=>x[1]));
if(archive.length!==total||!crypto.createHash('sha256').update(archive).digest().equals(expected)) throw new Error('sha mismatch');
fs.writeFileSync('.source.tar.gz',archive); fs.rmSync('.source',{recursive:true,force:true}); fs.mkdirSync('.source');
execFileSync('tar',['-xzf','.source.tar.gz','-C','.source']);
const src=path.join('.source','Noemelyn-Rwin-Vercel');
for(const name of fs.readdirSync(src)) fs.cpSync(path.join(src,name),name,{recursive:true,force:true});
console.log('SOURCE_SHA256='+expected.toString('hex'));
execFileSync('npm',['ci'],{stdio:'inherit'});
execFileSync('npm',['run','build'],{stdio:'inherit'});
