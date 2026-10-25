import sys, bs4, re
for f in sys.argv[1:]:
    s = bs4.BeautifulSoup(open(f, encoding='utf-8', errors='ignore'), 'html.parser')
    for x in s(['script','style','noscript','svg']): x.decompose()
    t = re.sub(r'\s*\n\s*', '\n', s.get_text('\n'))
    open(f.rsplit('.',1)[0]+'.full.txt','w').write(t)
