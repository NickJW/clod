import json, os, re, sys, random, urllib.request
K=os.environ['KEY']; MODEL=os.environ.get('JM','gemini-3.5-flash')
proxy=os.environ.get('HTTPS_PROXY'); op=urllib.request.build_opener(urllib.request.ProxyHandler({'https':proxy}))
d=json.load(open(sys.argv[1]))
sample=open(os.environ.get('SAMPLE', 'voice_sample.txt')).read()
def metrics(t):
    w=t.split(); s=[x for x in re.split(r'(?<=[.!?])["”’]?\s+',t) if len(x.split())>1]
    q=' '.join(re.findall(r'"[^"]*"',t)).split()
    return {'words':len(w),'avg_sentence':round(len(w)/max(1,len(s)),1),'dialogue_pct':round(100*len(q)/max(1,len(w)))}
for k in d: print(k, metrics(d[k]['prose']))
random.seed(int(os.environ.get('SEED','3')))
keys=list(d); random.shuffle(keys)
labels={k:f'P{i+1}' for i,k in enumerate(keys)}
gx,gy=('B','C') if random.random()<.5 else ('C','B')
N=len(keys)
prompt=f"""You are an experienced fiction editor judging style, blind. Below: the author's own writing sample, two style targets (X and Y) describing influences she might want, and several passages written for the same scene.

AUTHOR SAMPLE:
<sample>{sample}</sample>

STYLE TARGET X (influences): {d[gx].get('influences') or ''}
STYLE TARGET Y (influences): {d[gy].get('influences') or ''}

""" + '\n\n'.join(f'{labels[k]}:\n<passage>{d[k]["prose"]}</passage>' for k in keys) + """

For each passage answer in JSON: {"P1": {"closest": "X"|"Y"|"neither", "x_influence": 0-10, "y_influence": 0-10, "sounds_like_author": 0-10, "why": "one sentence"}, ...}. x_influence = how clearly a reader who knows those authors would feel target X's qualities (tone, humour, pacing, sentence shape) on the page. Be strict and specific. Then add "distinct": 0-10, how different the passages are in style from each other."""
body={"contents":[{"parts":[{"text":prompt}]}],"generationConfig":{"responseMimeType":"application/json","temperature":0.2}}
req=urllib.request.Request(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",data=json.dumps(body).encode(),headers={'x-goog-api-key':K,'content-type':'application/json'})
r=json.load(op.open(req,timeout=180))
res=json.loads(r['candidates'][0]['content']['parts'][0]['text'])
inv={v:k for k,v in labels.items()}
tgt={'X':gx,'Y':gy}
for p,v in res.items():
    if p in inv:
        print(f"{inv[p]}: closest={tgt.get(v['closest'],'neither')} B_influence={v['x_influence'] if gx=='B' else v['y_influence']} C_influence={v['y_influence'] if gy=='C' else v['x_influence']} sounds_like_author={v['sounds_like_author']} | {v['why']}")
print('distinct:', res.get('distinct'))
