import sys, bs4, re
for f in sys.argv[1:]:
    s = bs4.BeautifulSoup(open(f, encoding='utf-8', errors='ignore'), 'html.parser')
    for x in s(['script', 'style', 'nav', 'header', 'footer', 'noscript', 'svg']): x.decompose()
    m = s.find('main') or s.body or s
    t = re.sub(r'\n\s*\n+', '\n', m.get_text('\n'))
    open(f.rsplit('.', 1)[0] + '.txt', 'w').write(t)
    print(f, len(t))
