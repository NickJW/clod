# Builds the final tour from raw.webm + narration clips.
# Scene starts come from the coloured marker strip along the bottom edge (see record.mjs).
# Each scene is fitted to its narration: sped up (max 1.4x) when the video has spare time,
# or held on its last frame when the narration runs longer. The marker strip is cropped off.
import json, subprocess, sys, wave, imageio_ffmpeg, numpy as np
ff = imageio_ffmpeg.get_ffmpeg_exe()
W, H, STRIP = 1600, 1000, 6
items = json.load(open('narration.json'))
ids = [n['id'] for n in items]
dur = {k: wave.open(f'{k}.wav').getnframes() / 44100 for k in ids}

# 1) Read the marker colour at 10 fps.
p = subprocess.run([ff, '-v', 'error', '-i', 'raw.webm', '-vf', f'fps=10,crop=40:2:20:{H-4},format=rgb24', '-f', 'rawvideo', '-'], capture_output=True, check=True)
px = np.frombuffer(p.stdout, np.uint8).reshape(-1, 2 * 40, 3).mean(1)
total = len(px) / 10
def colour(step): return np.array([(step * 37) % 256, (step * 91) % 256, (step * 53) % 256])
starts = {}
for i, k in enumerate(ids):
    c = colour(i + 1)
    hit = np.where(np.abs(px - c).max(1) < 18)[0]
    after = [h for h in hit if not starts or h / 10 > max(starts.values())]
    if not after: sys.exit(f'marker for {k} not found')
    starts[k] = after[0] / 10
print('starts', starts)

# 2) Fit each scene to its narration.
segs, out_starts, t = [], {}, 0.0
for i, k in enumerate(ids):
    s = starts[k] - (0.6 if i == 0 else 0)
    e = starts[ids[i + 1]] if i + 1 < len(ids) else min(total, starts[k] + dur[k] + 4)
    vlen = e - s
    need = dur[k] + 0.35 + (0.6 if i == 0 else 0) + 1.0
    f = min(1.4, vlen / (need + 1.0)) if vlen > need + 2.5 else 1.0
    out = vlen / f
    pad = max(0.0, need - out)
    segs.append((s, e, f, pad))
    out_starts[k] = t + (0.6 if i == 0 else 0)
    t += out + pad
    print(f'{k:11s} video {vlen:5.1f}s  voice {dur[k]:5.1f}s  speed {f:.2f}  hold {pad:.1f}s')
json.dump(out_starts, open('outstarts.json', 'w'))

import os, re
os.makedirs('segs', exist_ok=True)
lst = []
real_starts, acc = {}, 0.0
for i, (s, e, f, pad) in enumerate(segs):
    chain = f'setpts=(PTS-STARTPTS)/{f:.4f}'
    if pad > 0.01: chain += f',tpad=stop_mode=clone:stop_duration={pad:.3f}'
    chain += f',fps=25,crop={W}:{H-STRIP}:0:0,format=yuv420p'
    out = f'segs/{i:02d}.mp4'
    subprocess.run([ff, '-y', '-v', 'error', '-ss', f'{s:.3f}', '-to', f'{e:.3f}', '-i', 'raw.webm', '-vf', chain, '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '12', out], check=True)
    lst.append(f"file '{os.path.abspath(out)}'")
    r = subprocess.run([ff, '-i', out, '-map', '0:v', '-f', 'null', '-'], capture_output=True, text=True)
    frames = int(re.findall(r'frame=\s*(\d+)', r.stderr)[-1])
    real_starts[ids[i]] = acc + (0.6 if i == 0 else 0)
    acc += frames / 25
open('segs/list.txt', 'w').write('\n'.join(lst) + '\n')
subprocess.run([ff, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'segs/list.txt', '-c', 'copy', 'video.mp4'], check=True)
out_starts, t = real_starts, acc
json.dump(out_starts, open('outstarts.json', 'w'))
vf = []
ins = []
for i, k in enumerate(ids):
    ins += ['-i', f'{k}.wav']
    d = int((out_starts[k] + 0.35) * 1000)
    vf.append(f'[{i+1}:a]aresample=48000,adelay={d}|{d}[a{i}]')
vf.append(''.join(f'[a{i}]' for i in range(len(ids))) + f'amix=inputs={len(ids)}:normalize=0,apad[aud]')
base = [ff, '-y', '-v', 'error', '-i', 'video.mp4'] + ins + ['-filter_complex', ';'.join(vf), '-map', '0:v', '-map', '[aud]', '-t', f'{t:.2f}']
subprocess.run(base + ['-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', 'out.mp4'], check=True)
subprocess.run(base + ['-c:v', 'libvpx-vp9', '-crf', '40', '-b:v', '0', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', '-c:a', 'libopus', '-b:a', '64k', 'out.webm'], check=True)
print('length', round(t, 1))
