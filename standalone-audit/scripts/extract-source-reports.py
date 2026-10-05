"""Extract complete OBAN issue tables with provenance; keep supplied PDFs outside Git.
Usage: python extract-source-reports.py SOURCE_DIRECTORY NEW_OUTPUT_DIRECTORY
"""
import hashlib,json,re,shutil,sys
from pathlib import Path
import pdfplumber

source,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=False)
project='project_opsl_15000ha_development'
package={'schemaVersion':1,'companyName':'JB FARMS OBAN Plantation','projectName':'OBAN Plantation','reports':{},'entries':[]}
for year in (2024,2025):
    pdf=source/f'OBAN AUDIT REPORT {year}.pdf'
    digest=hashlib.sha256(pdf.read_bytes()).hexdigest()
    target=out/'reports'/str(year);target.mkdir(parents=True)
    shutil.copyfile(pdf,target/'original.pdf')
    sections={};page_data=[];current_field='finding';last_issue=None;warnings=[]
    with pdfplumber.open(pdf) as doc:
        for number,page in enumerate(doc.pages,1):
            tables=page.find_tables()
            all_text=page.extract_text() or ''
            page_data.append({'page':number,'text':all_text,'width':page.width,'height':page.height,'imageCount':len(page.images),'tables':[{'bbox':t.bbox,'rows':t.extract()} for t in tables]})
            outer=[t for t in tables if any(re.search(r'\d+\.\s*Audit Issue:',str(c)) for row in t.extract()[:2] for c in row if c)]
            if not outer:
                if number>=(6 if year==2024 else 8):warnings.append(f'No issue table on page {number}')
                continue
            table=max(outer,key=lambda t:(t.bbox[2]-t.bbox[0])*(t.bbox[3]-t.bbox[1]))
            rows=table.extract();header=' '.join(c or '' for c in rows[0]);m=re.search(r'(\d+)\.\s*Audit Issue:\s*(.*?)\s*(?:Priority:|$)',header,re.S)
            issue=int(m[1]);dept=re.sub(r'\s+',' ',m[2]).strip()
            if issue!=last_issue:current_field='finding';last_issue=issue
            e=sections.setdefault(issue,{'id':f'oban_{year}_issue_{issue:02d}','projectId':project,'auditYear':str(year),'entity':'JB FARMS OBAN Plantation','department':dept,'area':'Source report audit issue','priority':'','location':'OBAN Plantation, Cross River State, Nigeria','finding':'','impact':'','recommendation':'','owner':'','dueDate':'','status':'Open','actions':[],'geo':None,'source':f'OBAN AUDIT REPORT {year}','capturedAt':f'{year}-01-01T00:00:00.000Z','sourceReport':{'year':str(year),'issue':issue,'sha256':digest,'pages':[],'managementResponse':'','timeline':'','tables':[]}})
            e['sourceReport']['pages'].append(number)
            for t in tables:
                if t is not table and t.bbox[0]>=table.bbox[0] and t.bbox[2]<=table.bbox[2]:e['sourceReport']['tables'].append({'page':number,'rows':t.extract()})
            priority=' '.join(c or '' for row in rows[:2] for c in row)
            pm=re.search(r'\b(High|Medium|Low|Critical)\b',priority)
            if pm:e['priority']=pm[1]
            for row in rows[1:]:
                if all(not c or re.fullmatch(r"(?:Priority:)?\s*(?:High|Medium|Low|Critical)?", c.strip()) for c in row):continue
                label=re.sub(r'\s+',' ',row[0] or '').strip();cells=[c for c in row[1:] if c and c.strip()]
                if 'Observation' in label or 'Finding' in label:current_field='finding'
                elif label.startswith('Impact'):current_field='impact'
                elif label.startswith('Recommendation'):current_field='recommendation'
                elif 'Management' in label or 'Response' in label:current_field='managementResponse'
                elif label:warnings.append(f'Unexpected row label {year} page {number}: {label}')
                for cell in cells:
                    cell=cell.replace('\uf0b7','•').strip()
                    if cell.startswith('Department in-charge:'):
                        e['owner']=re.sub(r'^Department in-charge:\s*','',cell).strip();continue
                    if cell.startswith('Timeline for completion:'):
                        e['sourceReport']['timeline']=re.sub(r'^Timeline for completion:\s*','',cell).strip();continue
                    obj=e['sourceReport'] if current_field=='managementResponse' else e
                    obj[current_field]+=('\n\n' if obj[current_field] else '')+cell
        assert len(sections)==22,(year,len(sections))
        assert not warnings,warnings
        for issue,e in sections.items():
            assert all(e[k] for k in ['finding','priority']),(year,issue,'missing observation/priority')
            e['sourceReport']['omittedSections']=[k for k in ['impact','recommendation'] if not e[k]]
            if not e['sourceReport']['managementResponse']:e['sourceReport']['omittedSections'].append('managementResponse')
            e['sourceReport']['originalRecommendation']=e['recommendation']
            baseline=[e['department'],e['priority'],e['finding'],e['impact'],e['recommendation'],e['sourceReport']['managementResponse']]
            e['sourceReport']['recordHash']=hashlib.sha256(json.dumps(baseline,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
            pages=e['sourceReport']['pages'];e['reference']=f'OBAN {year} / Issue {issue} / pp. {pages[0]}-{pages[-1]}'
            # The reports do not supply per-finding timestamps or dated due dates.
            e['capturedAt']='';e['updatedAt']=''
        metadata={'year':str(year),'filename':pdf.name,'sha256':digest,'pageCount':len(doc.pages),'issueCount':len(sections),'companyName':package['companyName'],'settings':{'auditReportTitle':f'{year} Internal Audit Report','auditClientName':package['companyName'],'auditLocation':'Cross River State, Nigeria','auditPreparedBy':'Agrinexus International','auditPeriodStart':'2025-10-25' if year==2025 else '', 'auditPeriodEnd':'2025-11-06' if year==2025 else '', 'auditIssueDate':'2026-06-23' if year==2025 else '2025-05-28','auditConfidentiality':'Private & Confidential'},'pages':page_data,'sectionHashes':{e['id']:e['sourceReport']['recordHash'] for e in sections.values()}}
        (target/'extracted.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+'\n')
        package['reports'][str(year)]={k:v for k,v in metadata.items() if k!='pages'}
        package['entries'].extend(sections.values())
        print(year,'issues',len(sections),'pages',len(doc.pages),'nested tables',sum(len(e['sourceReport']['tables']) for e in sections.values()),'management responses',sum(bool(e['sourceReport']['managementResponse']) for e in sections.values()))
(out/'import.json').write_text(json.dumps(package,ensure_ascii=False,indent=2)+'\n')
print('Import package:',out)
