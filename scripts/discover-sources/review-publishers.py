"""Read-only, bounded verification of a controlled publisher seed file.

Usage: python3 scripts/discover-sources/review-publishers.py seeds.json output.json
Keeps metadata/evidence URLs and bounded publisher/about-page snapshots.
Never follows article links from feed items or publishes approvals.
"""
import concurrent.futures, hashlib, html, http.client, ipaddress, json, re, socket, ssl, sys, time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

AGENT='TheCountyPost/1.0 source review'
LIMIT=1_500_000

def request(url, check_url=None):
    for _ in range(5):
        if check_url: check_url(url)
        parts=urlsplit(url)
        if parts.scheme not in ['http','https'] or not parts.hostname or parts.username or parts.password:
            raise ValueError('Invalid public URL')
        port=parts.port or (443 if parts.scheme=='https' else 80)
        if port not in [80,443]: raise ValueError('Unsupported port')
        addresses=socket.getaddrinfo(parts.hostname,port,type=socket.SOCK_STREAM)
        if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
            raise ValueError('Non-public network address')
        # Pin the validated IP; TLS still verifies the original publisher hostname.
        connection=http.client.HTTPConnection(parts.hostname,port,timeout=8)
        raw=socket.create_connection((addresses[0][4][0],port),timeout=8)
        connection.sock=ssl.create_default_context().wrap_socket(raw,server_hostname=parts.hostname) if parts.scheme=='https' else raw
        try:
            connection.request('GET',(parts.path or '/')+('?' + parts.query if parts.query else ''),headers={'Host':parts.netloc,'User-Agent':AGENT,'Accept-Encoding':'identity','Accept':'text/html, application/rss+xml, application/atom+xml, application/xml, text/plain;q=0.8'})
            response=connection.getresponse()
            if response.status in [301,302,303,307,308]:
                location=response.getheader('Location')
                if not location:raise ValueError('Redirect has no location')
                url=urljoin(url,location);continue
            if response.status!=200:raise ValueError('HTTP '+str(response.status))
            if int(response.getheader('Content-Length') or 0)>LIMIT:raise ValueError('Response too large')
            if response.getheader('Content-Encoding','identity')!='identity':raise ValueError('Unexpected compressed response')
            body=response.read(LIMIT+1)
            if len(body)>LIMIT:raise ValueError('Response too large')
            return url,body.decode('utf-8',errors='replace')
        finally:connection.close()
    raise ValueError('Too many redirects')

def clean(text):
    text=re.sub(r'<(script|style)\b[^>]*>.*?</\1>',' ',text,flags=re.S|re.I)
    return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]*>',' ',text))).strip()

def verify(seed):
    result={**seed,'checkedAt':datetime.now(timezone.utc).isoformat(),'homepage':{},'about':{},'feeds':[]}
    root=seed['websiteUrl']
    robots={}
    def allowed(url):
        parts=urlsplit(url); origin=parts.scheme+'://'+parts.netloc
        if origin not in robots:
            parser=RobotFileParser()
            try:
                _,body=request(origin+'/robots.txt');parser.parse(body.splitlines());robots[origin]=parser
            except Exception as error:
                if 'HTTP 404' in str(error):robots[origin]=None
                else:raise ValueError('Robots unavailable: '+str(error))
        if robots[origin] and not robots[origin].can_fetch(AGENT,url):raise ValueError('Disallowed by robots.txt')
    try:
        final,body=request(root, allowed)
        result['homepage']={'url':final,'sha256':hashlib.sha256(body.encode()).hexdigest(),'title':clean(re.search(r'<title[^>]*>(.*?)</title>',body,re.S|re.I)[1]) if re.search(r'<title[^>]*>(.*?)</title>',body,re.S|re.I) else ''}
        result['homepage']['description']=next((html.unescape(m[2]) for m in re.findall(r'<meta\s+[^>]*(?:name|property)=[\"\x27](description|og:description)[\"\x27][^>]*content=([\"\x27])(.*?)\2',body,re.S|re.I)), '')
        links=[urljoin(final,html.unescape(m[1])) for m in re.finditer(r'href=[\"\x27]([^\"\x27]+)[\"\x27]',body,re.I)]
        about=next((url for url in links if urlsplit(url).hostname==urlsplit(final).hostname and re.search(r'/(about|about-us|who-we-are|contact-us|contact)/?$',urlsplit(url).path)),None)
        if about:
            try:
                about_url,about_body=request(about, allowed)
                result['about']={'url':about_url,'sha256':hashlib.sha256(about_body.encode()).hexdigest(),'text':clean(about_body)[:14000]}
            except Exception as error:result['about']={'url':about,'error':str(error)}
        declared=[]
        for tag in re.findall(r'<link\b[^>]*>',body,re.I):
            if re.search(r'application/(?:rss|atom)\+xml',tag,re.I):
                href=re.search(r'href=[\"\x27]([^\"\x27]+)',tag,re.I)
                if href:declared.append(urljoin(final,html.unescape(href[1])))
        feed_urls=list(dict.fromkeys(declared+seed.get('proposedFeeds',[])))
        for url in [u for u in feed_urls if not re.search(r'comments|comment-feed|podcast',u,re.I)][:2]:
            try:
                feed_url,xml=request(url, allowed)
                if re.search(r'<!DOCTYPE|<!ENTITY',xml,re.I):raise ValueError('XML declarations not accepted')
                doc=ET.fromstring(xml)
                if doc.tag not in ['rss','{http://www.w3.org/2005/Atom}feed']:raise ValueError('Not RSS or Atom')
                items=doc.findall('./channel/item') or doc.findall('{http://www.w3.org/2005/Atom}entry')
                samples=[]
                for item in items[:12]:
                    title=item.findtext('title') or item.findtext('{http://www.w3.org/2005/Atom}title') or ''
                    link=item.findtext('link') or next((a.attrib.get('href','') for a in item.findall('{http://www.w3.org/2005/Atom}link') if a.attrib.get('rel','alternate')=='alternate'),'')
                    date=item.findtext('pubDate') or item.findtext('{http://www.w3.org/2005/Atom}published') or item.findtext('{http://www.w3.org/2005/Atom}updated') or ''
                    samples.append({'title':clean(title),'url':link,'publishedAt':date})
                result['feeds'].append({'url':feed_url,'items':len(items),'samples':samples,'sha256':hashlib.sha256(xml.encode()).hexdigest()})
            except Exception as error:result.setdefault('feedErrors',[]).append({'url':url,'error':str(error)})
            time.sleep(0.2)
        result['status']='verified-homepage'
    except Exception as error:
        result['status']='unresolved';result['error']=str(error)
    return result

if __name__=='__main__':
    seeds=json.loads(Path(sys.argv[1]).read_text());out=Path(sys.argv[2]);checkpoint=out.with_suffix('.jsonl')
    prior={row['websiteUrl']:row for row in (json.loads(line) for line in checkpoint.read_text().splitlines())} if checkpoint.exists() else {}
    todo=[s for s in seeds if s['websiteUrl'] not in prior]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for row in pool.map(verify,todo):
            prior[row['websiteUrl']]=row
            with checkpoint.open('a') as file:file.write(json.dumps(row)+'\n')
            print(row.get('name'),row['status'],'feeds='+str(len(row['feeds'])),flush=True)
    out.write_text(json.dumps(list(prior.values()),indent=2)+'\n')
    print('Reviewed',len(prior),'publishers',flush=True)
