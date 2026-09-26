import json, subprocess, imageio_ffmpeg
ff=imageio_ffmpeg.get_ffmpeg_exe()
st=json.load(open('vstarts.json')); ids=[n['id'] for n in json.load(open('narration.json'))]
trim=st['welcome']-0.6
ins=[]; filt=[]
for i,k in enumerate(ids):
    ins+=['-i',f'{k}.wav']
    d=int((st[k]-trim+0.35)*1000)
    filt.append(f'[{i+1}:a]aresample=48000,adelay={d}|{d}[a{i}]')
filt.append(''.join(f'[a{i}]' for i in range(len(ids)))+f'amix=inputs={len(ids)}:normalize=0,apad[aud]')
end=405.5-trim
base=[ff,'-y','-v','error','-ss',str(trim),'-t',str(end),'-i','raw.webm']+ins+['-filter_complex',';'.join(filt),'-map','0:v','-map','[aud]','-shortest']
subprocess.run(base+['-c:v','libx264','-preset','slow','-crf','27','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','out.mp4'],check=True)
subprocess.run(base+['-c:v','libvpx-vp9','-crf','40','-b:v','0','-row-mt','1','-deadline','good','-cpu-used','4','-c:a','libopus','-b:a','64k','out.webm'],check=True)
print('trim',trim)
