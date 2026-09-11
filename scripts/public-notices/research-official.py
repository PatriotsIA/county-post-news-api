"""Download bounded public agency pages for source review; no application writes."""
import sys, urllib.request, pathlib, hashlib
out=pathlib.Path('coverage/public-notices'); out.mkdir(parents=True,exist_ok=True)
for url in sys.argv[1:]:
 try:
  req=urllib.request.Request(url,headers={'User-Agent':'TheCountyPost-source-review/1.0'})
  with urllib.request.urlopen(req,timeout=20) as r:
   body=r.read(4000000); name=hashlib.sha256(url.encode()).hexdigest()[:12]+'.html'; (out/name).write_bytes(body)
   print(r.status,r.url,len(body),name,flush=True)
 except Exception as e:print(url,type(e).__name__,str(e)[:120],flush=True)
