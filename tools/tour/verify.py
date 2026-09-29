import json, base64, urllib.request, os, sys, subprocess, re
K=os.environ['KEY']; FF=os.environ['FF']
proxy=os.environ.get('HTTPS_PROXY')
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':proxy}))
items={i['id']:i for i in json.load(open('narration.json'))}
norm=lambda s: re.sub(r'[^a-z ]','',s.lower()).split()
for f in sorted(os.listdir('.')):
    if not f.endswith('.wav'): continue
    idn=f[:-4]
    subprocess.run([FF,'-y','-loglevel','error','-i',f,'-ar','16000','-ac','1','/tmp/v.mp3'],check=True)
    data=base64.b64encode(open('/tmp/v.mp3','rb').read()).decode()
    body={"contents":[{"parts":[{"inlineData":{"mimeType":"audio/mp3","data":data}},{"text":"Transcribe this audio exactly, word for word. Output only the transcript."}]}]}
    req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent",data=json.dumps(body).encode(),headers={'x-goog-api-key':K,'content-type':'application/json'})
    try:
        d=json.load(opener.open(req,timeout=120))
        t=d['candidates'][0]['content']['parts'][0]['text'].strip()
    except Exception as e:
        print(idn,'ERROR',e); continue
    got=norm(t); want=norm(items[idn]['text'])
    extra=len(got)-len(want)
    ok = got[:4]==want[:4] and abs(extra)<=3
    print(f"{idn:11} {'OK ' if ok else 'CHECK'} starts: \"{' '.join(got[:7])}\" words {len(got)}/{len(want)}")
