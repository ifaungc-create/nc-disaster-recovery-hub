import re,json
# Directory rows are not always aligned to the page header, and a long department name can run into the
# chief column with a single space ("...Department, Timothy Mark Bartlett P.O. Box 365"). split_name()
# finds where the name ends: the LAST name-ending word (Inc., Department, Rescue, ...) that is followed
# only by a person-like name (and maybe the start of the address). Otherwise fall back to cutting at the
# chief column, backing off to a word boundary so no chief first-name fragment sticks to the name.
SUFFIX=re.compile(r"(Inc\.?,?|Incorporated|Department,?|Dept\.?,?|Association,?|Rescue,?|Squad,?|District,?|Services,?|Service|EMS,?|E\.M\.S\.,?|Responders|Company|Corporation|Protection|Team|Authority|Ems|N\.C\.?)$")
NOTPERSON=set("of Of and And & City County Inc Inc. Inc., Incorporated Township Volunteer Fire Rescue Department Dept Community Rural Association Squad Emergency Medical Services Service EMS District Station Protection Company the The Town Village".split())
PERSON=re.compile(r"^[A-Z][A-Za-z'\-]+\.?$|^[A-Z]\.?$")
ADDR=re.compile(r" (?=(?:P\.? ?O\.?|PO|Post Office|\d+)\b)")
def cut(line,col):
    s=line[:col]
    if len(line)>col and s and not s[-1].isspace() and not line[col].isspace():
        s=s[:s.rstrip().rfind(' ')+1] if ' ' in s.strip() else s
    return s.strip()
def split_name(line,col):
    first=re.split(r"\s{2,}",line.strip())[0]
    m=ADDR.search(first,max(col-2,0))  # an address only starts past the chief column
    if m: first=first[:m.start()]
    toks=first.split(' '); best=None
    for i in range(1,len(toks)):
        rest=toks[i:]
        if SUFFIX.search(toks[i-1]) and 2<=len(rest)<=4 and all(PERSON.match(t) for t in rest) and not any(t.strip(',.') in NOTPERSON for t in rest) and any(len(t.strip(',.'))>=3 for t in rest): best=i
    if best: return ' '.join(toks[:best])
    if len(first)>col-1: return cut(line,col)
    return first.strip()
L=open('osfm_directory.txt').read().split('\n')
rows=[];counties={}
i=0;cur=None
hdr=None
while i<len(L):
    l=L[i]
    m=re.match(r'^(\S.*? County)(?:\s{3,}(\(\d{3}\) \d{3}-\d{4}|null))?\s*$',l)
    if m and not (i+1<len(L) and ('email:' in L[i+1] or 'Fire Department / Rescue' in L[i+1] or (m.group(2)))): m=None
    if m and 'Fire Department' not in l and not re.search(r'\s\d{5}\s*$',l):
        # contact block: preceding lines up to "Report Created" or blank
        cname=m.group(1).replace(' County','').strip()
        blk=[]
        j=i-1
        while j>=0 and L[j].strip() and 'Report Created' not in L[j] and 'FDID' not in L[j]:
            blk.insert(0,L[j]); j-=1
        # left column: text at column start of block
        col=len(l)-len(l[len(m.group(1)):].lstrip())  # position of phone
        if m.group(2) and m.group(2)!='null': col=l.index(m.group(2))
        else:
            col=len(blk[0])-len(blk[0].lstrip()) if blk else 70
            if col>110: blk=[]
        def left(s):
            s=s[col-2:] if len(s)>col-2 else ''
            parts=re.split(r'\s{3,}',s.strip())
            return parts[0] if parts else ''
        bl=[left(b) for b in blk]
        em=''
        if i+1<len(L) and 'email:' in L[i+1]: em=L[i+1].split('email:')[1].strip()
        cur=cname
        counties[cname]={'contactName':bl[0] if bl else '','contactTitle':bl[1] if len(bl)>1 else '','address':', '.join(x for x in bl[2:] if x),'phone':(m.group(2) or '').replace('null',''),'email':em}
        i+=1;continue
    if 'FDID' in l and 'Fire Department' in l:
        hdr={k:l.index(k) for k in ['Chief','Address','City / State','Phone No.','Email','FDID']}
        i+=1;continue
    m=re.search(r'\s(\d{5})\s*$',l)
    if m and hdr and cur:
        # Rows are not always aligned to the page header: a long name can run into the chief column.
        # cut() takes the text left of the chief column and, if the cut lands inside a word (the chief's
        # first name), backs off to the previous space so no chief fragment is glued onto the name.
        name=split_name(l,hdr['Chief'])
        city=l[hdr['City / State']-2:hdr['Phone No.']].strip()
        ph=re.search(r'\(\d{3}\) \d{3}-\d{4}',l[hdr['Phone No.']-3:])
        addr=l[hdr['Address']-3:hdr['City / State']-2].strip()
        # continuation lines (a line ending in a ZIP code >= 11000 is a wrapped city/ZIP, not a new FDID row)
        k=i+1
        while k<len(L) and L[k].strip() and not (re.search(r'\s\d{5}\s*$',L[k]) and int(re.search(r'(\d{5})\s*$',L[k]).group(1))<11000) and 'Report Created' not in L[k] and len(L[k])-len(L[k].lstrip())<5:
            name+=' '+split_name(L[k],hdr['Chief']); k+=1
        rows.append({'fdid':m.group(1),'name':re.sub(r'\s+',' ',name).strip(),'county':cur,'mail':addr,'cityStateZip':city,'phone':ph.group(0) if ph else ''})
    i+=1
rows=[r for r in rows if int(r['fdid'])<11000]  # 5-digit numbers >= 11000 are ZIP codes from county contact blocks, not FDIDs
fire=[r for r in rows if int(r['fdid'][-2:])<50]
print(len(rows),len(fire),len(counties))
json.dump({'counties':counties,'departments':rows},open('osfm_directory_parsed.json','w'),indent=1)
for c in list(counties)[:5]: print(c,counties[c])
print(fire[:3])
