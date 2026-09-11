"""Review TAC's official county links and notice calendars: four workers,
12-second/2 MB bounds, cached evidence; review output before runtime use."""
import concurrent.futures, hashlib, html, json, pathlib, re, urllib.parse, urllib.request
from datetime import datetime, timezone
OUT=pathlib.Path('coverage/public-notices'); OUT.mkdir(parents=True,exist_ok=True)
CACHE=OUT/'official-pages'; CACHE.mkdir(exist_ok=True)
def fetch(url):
 url=urllib.parse.quote(url,safe=":/?=&%#")
 p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+'.html')
 meta=p.with_suffix('.json')
 if p.exists() and meta.exists():return p.read_text(),json.loads(meta.read_text())['finalUrl']
 req=urllib.request.Request(url,headers={'User-Agent':'TheCountyPost-source-review/1.0'})
 with urllib.request.urlopen(req,timeout=12) as r:
  raw=r.read(2000001)
  if r.status!=200 or len(raw)>2000000:raise ValueError('invalid/oversized response')
  body=raw.decode('utf-8-sig','replace');p.write_text(body);meta.write_text(json.dumps({'requestedUrl':url,'finalUrl':r.url}));return body,r.url
def links(body,base):
 return [(urllib.parse.urljoin(base,html.unescape(u)),html.unescape(re.sub('<[^>]+>',' ',t)).strip()) for u,t in re.findall(r'''<a\b[^>]*href=["']([^"']+)["'][^>]*>(.*?)</a>''',body,re.I|re.S)]
mapbody,_=fetch('https://www.county.org/county-information-map')
entries=dict((html.unescape(re.sub('<[^>]+>','',label)).replace(' County','').strip(),urllib.parse.urljoin('https://www.county.org',url)) for url,label in re.findall(r'<a[^>]*data-county-id="[^"]+"[^>]*href="([^"]+)"[^>]*>(.*?)</a>',mapbody,re.S))
entries={name:url for name,url in entries.items() if '/content-library/maps/counties/' in url}
assert len(entries)==254,len(entries)
def review(item):
 name,evidence=item
 result={'county':name,'evidenceUrl':evidence,'reviewedAt':datetime.now(timezone.utc).isoformat(),'feeds':[]}
 try:
  body,_=fetch(evidence)
  site=next(u for u,t in links(body,evidence) if "county's website" in t.lower())
  result['websiteUrl']=site
  body,site=fetch(site);result['websiteUrl']=site
  choices=[(u,t) for u,t in links(body,site) if re.search(r'public\s*notices?|legal\s*notices?',t,re.I) and u.startswith('https://') and '#' not in u and not re.search(r'\.pdf|/DocumentCenter/View/|/upload/',u,re.I) and urllib.parse.urlparse(u).hostname==urllib.parse.urlparse(site).hostname]
  choices.sort(key=lambda x:(bool(re.search(r'news|archive',x[1],re.I)),len(x[1])))
  if choices:
   board,title=choices[0];result['noticeUrl']=board
   boardbody,board=fetch(board);result['noticeUrl']=board
   feeds=re.findall(r'''(?:copy-url|href)=["']([^"']+(?:\.rss|RSSFeed\.aspx)[^"']*)["']''',boardbody,re.I)
   for feed in list(dict.fromkeys(feeds))[:2]:
    feed=urllib.parse.urljoin(board,html.unescape(feed))
    if not feed.startswith('https://'):continue
    xml,final=fetch(feed)
    if '<rss' in xml:result['feeds'].append({'url':final,'dateKind':'event' if '/calrss/' in final else 'published','itemsAtReview':len(re.findall(r'<item[ >]',xml))})
  result['status']='reviewed'
 except Exception as e:result['error']=type(e).__name__+': '+str(e)[:110]
 return result
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for r in pool.map(review,entries.items()):
  results.append(r);(OUT/'texas-discovery.json').write_text(json.dumps(results,indent=2)+'\n')
  if len(results)%20==0 or r['feeds']:print(json.dumps({'done':len(results),'county':r['county'],'noticeUrl':r.get('noticeUrl'),'feeds':len(r['feeds']),'error':r.get('error')}),flush=True)
print(json.dumps({'counties':len(results),'websites':sum('websiteUrl'in r for r in results),'noticeBoards':sum('noticeUrl'in r for r in results),'feeds':sum(len(r['feeds'])for r in results)}),flush=True)
