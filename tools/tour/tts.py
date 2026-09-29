import json, base64, urllib.request, os, sys, time, wave, io, subprocess
K=os.environ['KEY']; FF=os.environ['FF']; MODEL=os.environ.get('MODEL','gemini-3.8-flash-tts')
items=json.load(open('narration.json'))
proxy=os.environ.get('HTTPS_PROXY')
opener=urllib.request.build_opener(urllib.request.ProxyHandler({'https':proxy,'http':proxy}))
import ssl
for it in items:
    out=f"{it['id']}.wav"
    if os.path.exists(out): continue
    body={"contents":[{"parts":[{"text":it['text']}]}],
          "generationConfig":{"responseModalities":["AUDIO"],"speechConfig":{"voiceConfig":{"prebuiltVoiceConfig":{"voiceName":"Sulafat"}}}}}
    d=None
    for attempt in range(4):
        req=urllib.request.Request("https://generativelanguage.googleapis.com/v1beta/models/"+MODEL+":generateContent",data=json.dumps(body).encode(),headers={'x-goog-api-key':K,'content-type':'application/json'})
        try:
            d=json.load(opener.open(req,timeout=180)); break
        except Exception as e:
            print(it['id'],'retry',e, file=sys.stderr); time.sleep(30)
    if d is None: sys.exit('failed: '+it['id'])
    part=d['candidates'][0]['content']['parts'][0]['inlineData']
    raw=base64.b64decode(part['data'])
    tmp=f"{it['id']}.src"
    open(tmp,'wb').write(raw)
    fmt = [] if part['mimeType']=='audio/wav' else ['-f','s16le','-ar','24000','-ac','1']
    subprocess.run([FF,'-y','-loglevel','error',*fmt,'-i',tmp,'-ar','44100','-ac','1',out],check=True)
    os.remove(tmp)
    time.sleep(22)
    w=wave.open(out); print(it['id'], round(w.getnframes()/w.getframerate(),1),'s', flush=True)
