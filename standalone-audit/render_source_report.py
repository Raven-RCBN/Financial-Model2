"""Preserve the supplied report's original pages; append current database follow-up.
The source narrative is immutable. Workflow changes and additional findings are
rendered from current database records in a clearly labelled appendix.
"""
import hashlib,html,json,sys,os,base64,re
from io import BytesIO
from pathlib import Path
from pypdf import PdfReader,PdfWriter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Image,Table


def styled_text(value,styles=None):
    text=str(value or 'Not recorded')
    runs=[]
    for item in (styles if isinstance(styles,list) else [])[:5000]:
        if not isinstance(item,dict):continue
        start,end=item.get('start'),item.get('end')
        if type(start)!=int or type(end)!=int or not 0<=start<end or start>=len(text):continue
        runs.append(dict(item,start=start,end=min(end,len(text))))
    points=sorted({0,len(text),*(r['start'] for r in runs),*(r['end'] for r in runs)})
    parts=[]
    for start,end in zip(points,points[1:]):
        active=[r for r in runs if r['start']<=start and r['end']>=end]
        tags=[tag for key,tag in [('bold','b'),('italic','i'),('underline','u')] if any(r.get(key) is True for r in active)]
        parts.append(''.join('<'+t+'>' for t in tags)+html.escape(text[start:end]).replace('\n','<br/>')+''.join('</'+t+'>' for t in reversed(tags)))
    return ''.join(parts)

def paragraph(value,style,text_styles=None):
    return Paragraph(styled_text(value,text_styles),style)

def evidence_image(item,compact=False):
    value=item.get('dataUrl') or item.get('url') or ''
    if value.startswith('data:image/'):
        stream=BytesIO(base64.b64decode(value.split(',',1)[1]))
    elif value.startswith('/audit/uploads/'):
        root=Path(os.environ['AUDIT_UPLOAD_ROOT']).resolve();candidate=(root/value[len('/audit/uploads/'):].split('?',1)[0]).resolve()
        if not candidate.is_relative_to(root):raise ValueError('Invalid evidence path')
        stream=str(candidate)
    elif value.startswith('/audit/evidence/'):
        root=Path(__file__).resolve().parent
        if not (root/'audit').exists():root=root.parent
        stream=str(root/value.lstrip('/').split('?',1)[0])
    else:return None
    if compact:
        from PIL import Image as PILImage,ImageOps
        with PILImage.open(stream) as original:
            original.thumbnail((1800,1800))
            photo=ImageOps.exif_transpose(original).convert('RGB');compressed=BytesIO();photo.save(compressed,format='JPEG',quality=85);compressed.seek(0);stream=compressed
    img=Image(stream);scale=min(450/img.imageWidth,430/img.imageHeight,1)
    img.drawWidth=img.imageWidth*scale;img.drawHeight=img.imageHeight*scale
    return img

def build(payload):
    draft=payload.get('draftReport') is True
    report=None if draft else payload.get('sourceReport');entries=payload['entries'];settings=payload.get('reportSettings') or {}
    if draft:entries=sorted(entries,key=lambda e:((e.get('department') or 'Unassigned').casefold(),e.get('capturedAt') or '',e.get('id') or ''))
    imported=[];expected=set();reader=None;original=None
    if report:
        year=report['year'];source=Path(payload['sourceDirectory'])/'original.pdf';original=source.read_bytes()
        if hashlib.sha256(original).hexdigest()!=report['sha256']:raise ValueError('Source PDF checksum mismatch')
        reader=PdfReader(BytesIO(original))
        if len(reader.pages)!=report['pageCount']:raise ValueError('Source PDF page count mismatch')
        imported=[e for e in entries if (e.get('sourceReport') or {}).get('sha256')==report['sha256']]
        expected={f'oban_{year}_issue_{i:02d}' for i in range(1,report['issueCount']+1)}
        if {e['id'] for e in imported}!=expected or len(imported)!=len(expected):raise ValueError('Imported report sections are missing or duplicated')
        for e in imported:
            baseline=[e.get('department'),e.get('priority'),e.get('finding'),e.get('impact'),e['sourceReport'].get('originalRecommendation'),e['sourceReport'].get('managementResponse')]
            digest=hashlib.sha256(json.dumps(baseline,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
            if digest!=report['sectionHashes'][e['id']]:raise ValueError('Imported narrative differs from the verified source: '+e['id'])
    additional=[e for e in entries if e['id'] not in expected]
    tracked=[e for e in imported if e.get('actions')]
    # Byte-identical baseline when no post-import updates exist.
    if report and not additional and not tracked:return original
    width=float(reader.pages[0].mediabox.width) if reader else 595.28; height=float(reader.pages[0].mediabox.height) if reader else 841.89
    styles=getSampleStyleSheet();styles.add(ParagraphStyle(name='AuditBody',fontName='Helvetica',fontSize=10,leading=14,spaceAfter=9,textColor=colors.HexColor('#193d2d')))
    title='Current findings and corrective-action follow-up' if report else settings.get('auditReportTitle','Audit report')
    company=report['companyName'] if report else payload.get('auditEntity',settings.get('auditClientName',''))
    story=[paragraph(('DRAFT — ' if draft else '')+title,styles['Title']),paragraph(company,styles['Heading2'])]
    if draft:story.append(paragraph('FOR REVIEW ONLY — Not finalized. Grouped by department. Incomplete fields are shown as Not recorded.',styles['AuditBody']))
    if report:story.append(paragraph('The preceding pages preserve the original issued audit report. This appendix contains subsequent records and workflow updates from the Audit webapp.',styles['AuditBody']))
    else:
        story.append(paragraph((settings.get('auditConfidentiality') or 'Private & Confidential')+' | '+str(len(entries))+' findings',styles['AuditBody']))
        for label,key in [('Location','auditLocation'),('Prepared by','auditPreparedBy'),('Period start','auditPeriodStart'),('Period end','auditPeriodEnd'),('Issue date','auditIssueDate')]:
            if settings.get(key) and (not draft or key!='auditIssueDate'):story.append(paragraph(label+': '+settings[key],styles['AuditBody']))

    if draft:
        story.insert(0,Spacer(1,145))
        toc=TableOfContents()
        story.extend([PageBreak(),paragraph('Table of Contents',styles['Title']),toc])
    class DraftDocument(SimpleDocTemplate):
        def afterFlowable(self,flowable):
            if hasattr(flowable,'department_heading'):
                label,key=flowable.department_heading
                self.canv.bookmarkPage(key)
                self.notify('TOCEntry',(0,label,self.page,key))
    previous_department=None
    for issue_number,e in enumerate(additional+tracked,1):
        department=e.get('department') or 'Unassigned'
        if draft:
            story.append(PageBreak())
        if draft and department!=previous_department:
            heading=paragraph(department,styles['Title'])
            heading.department_heading=(html.escape(department),f'department-{issue_number}')
            story.append(heading);previous_department=department
        if draft:story.append(paragraph('Draft finding '+str(issue_number)+' | Priority: '+str(e.get('priority') or 'Not recorded'),styles['Heading2']))
        story.extend([Spacer(1,14),paragraph(e.get('reference') or e.get('department'),styles['Heading2'])])
        evidence=e.get('observationImages') or ([{'url':e.get('photoUrl'),'dataUrl':e.get('photoDataUrl'),'name':e.get('photoName')}] if e.get('photoUrl') or e.get('photoDataUrl') else [])
        matched=set()
        if e in additional:
            for title,key in [('Company','entity'),('Observations / Findings','finding'),('Impact','impact'),('Recommendation','recommendation'),('Status','status')]:
                if draft and (key=='status' or (key=='recommendation' and e.get('actions'))):continue
                story.append(paragraph(title,styles['Heading3']))
                if draft and key=='finding' and evidence and e.get(key):
                    rows=[[paragraph('Finding point',styles['Heading3']),paragraph('Matching evidence',styles['Heading3'])]]
                    offset=0
                    for line in e[key].split('\n'):
                        marks=[dict(mark,start=max(0,mark['start']-offset),end=min(len(line),mark['end']-offset)) for mark in e.get('findingStyles') or []]
                        offset+=len(line)+1
                        if not line.strip():continue
                        numbers=[]
                        for ref in re.findall(r'\bimages?\s*#?\s*(\d+(?:\s*(?:[,/&–—-]|and|to)\s*#?\s*\d+)*)',line,re.I):
                            for part in re.split(r'[,/&]|\band\b',ref):
                                bounds=[int(n) for n in re.findall(r'\d+',part)]
                                if bounds:
                                    numbers.extend(range(max(1,bounds[0]),min(len(evidence),bounds[-1])+1))
                        images=[]
                        for number in dict.fromkeys(numbers):
                            item=evidence[number-1]
                            img=evidence_image(item,compact=True)
                            if img:
                                scale=min(1,185/img.drawWidth,165/img.drawHeight)
                                img.drawWidth*=scale;img.drawHeight*=scale
                                images.extend([img,paragraph(f'Image {number}',styles['AuditBody'])])
                                matched.add(number)
                        rows.append([paragraph(line,styles['AuditBody'],marks),images or ''])
                    story.append(Table(rows,colWidths=[(width-122)*.58,(width-122)*.42],repeatRows=1,splitInRow=1,style=[('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),.35,colors.HexColor('#cccccc')),('BACKGROUND',(0,0),(-1,0),colors.HexColor('#eeeeee'))]))
                    continue
                if key=='recommendation' and e.get('actions'):
                    for action in e['actions']:story.append(paragraph(action.get('description'),styles['AuditBody'],action.get('descriptionStyles')))
                else:story.append(paragraph(e.get(key),styles['AuditBody'],e.get(key+'Styles')))
        else:story.append(paragraph('Original source issue '+str(e['sourceReport']['issue'])+'; pages '+', '.join(map(str,e['sourceReport']['pages'])),styles['AuditBody']))
        if e in additional:
            photos=[]
            for number,item in enumerate(evidence,1):
                if number in matched:continue
                img=evidence_image(item,compact=draft)
                if img:
                    caption=paragraph(item.get('description') or item.get('name') or 'Evidence',styles['AuditBody'],item.get('descriptionStyles'))
                    if draft:
                        scale=min(1,225/img.drawWidth,205/img.drawHeight)
                        img.drawWidth*=scale
                        img.drawHeight*=scale
                        photos.append([img,caption])
                    else:
                        story.extend([img,caption])
            for start in range(0,len(photos),6):
                cells=photos[start:start+6]
                cells += ['']*(6-len(cells))
                story.extend([PageBreak(),Table([cells[:2],cells[2:4],cells[4:]],colWidths=[(width-122)/2]*2,style=[('VALIGN',(0,0),(-1,-1),'TOP')])])
        for n,a in enumerate(e.get('actions',[]),1):
            story.extend([paragraph('Recommendation '+str(n),styles['Heading3']),paragraph(a.get('description'),styles['AuditBody'],a.get('descriptionStyles')),paragraph('Responsible person: '+a.get('owner','')+' | Email: '+a.get('email','')+' | Due: '+a.get('dueDate','')+' | Status: '+a.get('status',''),styles['AuditBody'])])
            for r in a.get('responses',[]):
                story.extend([paragraph('Corrective action by '+r.get('author','')+' | '+r.get('createdAt','')+' | Status: '+r.get('status','')+' | Follow-up due: '+r.get('dueDate',''),styles['Heading3']),paragraph(r.get('text'),styles['AuditBody'],r.get('textStyles'))])
                for item in r.get('images',[]):
                    img=evidence_image(item,compact=draft)
                    if img:story.extend([img,paragraph(item.get('description') or item.get('name') or 'Action evidence',styles['AuditBody'])])
    logo=next((p for p in (Path(__file__).resolve().parent/'public/agrinexus-logo.jpeg',Path(__file__).resolve().parent.parent/'public/agrinexus-logo.jpeg',Path.cwd()/'public/agrinexus-logo.jpeg') if p.is_file()),None)
    def page_footer(c,doc):
        if not draft:return
        c.saveState()
        if doc.page==1:
            c.setFillColor(colors.HexColor('#eeeeee'));c.rect(0,0,38,height,stroke=0,fill=1)
            c.setFillColor(colors.HexColor('#c94d4a'));c.rect(55,height-178,88,46,stroke=0,fill=1)
            c.setFillColor(colors.white);c.setFont('Helvetica-Bold',16);c.drawCentredString(99,height-162,'DRAFT')
        c.setFillColor(colors.HexColor('#333333'));c.setFont('Helvetica-Oblique',9)
        c.drawString(55,height-34,company)
        c.drawRightString(width-88,height-34,settings.get('auditConfidentiality') or 'Private & Confidential')
        c.setStrokeColor(colors.HexColor('#555555'))
        c.line(55,height-45,width-55,height-45)
        c.line(55,43,width-55,43)
        if logo:
            c.drawImage(str(logo),width-78,height-40,23,23,mask='auto',preserveAspectRatio=True)
            c.drawImage(str(logo),55,13,22,22,mask='auto',preserveAspectRatio=True)
        c.setFillColor(colors.HexColor('#9e3734'));c.setFont('Helvetica-Bold',9)
        c.drawCentredString(width/2,25,'DRAFT — FOR REVIEW ONLY')
        c.drawRightString(width-55,25,str(doc.page))
        c.restoreState()
    buffer=BytesIO()
    doc=(DraftDocument if draft else SimpleDocTemplate)(buffer,pagesize=(width,height),leftMargin=55,rightMargin=55,topMargin=55,bottomMargin=55)
    if draft:
        doc.multiBuild(story,onFirstPage=page_footer,onLaterPages=page_footer)
        return buffer.getvalue()
    else:doc.build(story)
    writer=PdfWriter();
    if reader:writer.append(reader)
    writer.append(PdfReader(BytesIO(buffer.getvalue())))
    result=BytesIO();writer.write(result);return result.getvalue()

if __name__=='__main__':sys.stdout.buffer.write(build(json.loads(sys.stdin.read())))
