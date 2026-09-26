# Subtitles from the script: each scene's narration split into short cues spread over its time.
import json, re, sys
starts=json.load(open(sys.argv[1])); dur=json.load(open(sys.argv[2])); trim=float(sys.argv[3]); out=sys.argv[4]
items=json.load(open('narration.json'))
def ts(t):
    h=int(t//3600); m=int(t%3600//60); s=t%60
    return f"{h:02d}:{m:02d}:{s:06.3f}"
cues=[]
for it in items:
    s0=starts[it['id']]-trim+0.35; d=dur[it['id']]
    sents=re.split(r'(?<=[.!?])\s+', it['text'])
    chunks=[]
    for se in sents:
        words=se.split()
        while len(words)>16:
            chunks.append(' '.join(words[:12])); words=words[12:]
        if words: chunks.append(' '.join(words))
    total=sum(len(c) for c in chunks); t=s0
    for c in chunks:
        dd=d*len(c)/total
        cues.append((t,t+dd-0.05,c)); t+=dd
with open(out,'w') as f:
    f.write('WEBVTT\n\n')
    for i,(a,b,c) in enumerate(cues,1): f.write(f"{i}\n{ts(a)} --> {ts(b)}\n{c}\n\n")
print(len(cues),'cues')
