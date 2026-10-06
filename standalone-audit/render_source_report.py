"""Preserve the supplied report's original pages; append current database follow-up.
The source narrative is immutable. Workflow changes and additional findings are
rendered from current database records in a clearly labelled appendix.
"""
import hashlib,html,json,sys,os,base64
from io import BytesIO
from pathlib import Path
from pypdf import PdfReader,PdfWriter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,Image


def paragraph(value,style):
    return Paragraph(html.escape(str(value or 'Not recorded')).replace('\n','<br/>'),style)

def evidence_image(item):
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
    img=Image(stream);scale=min(450/img.imageWidth,430/img.imageHeight,1)
    img.drawWidth=img.imageWidth*scale;img.drawHeight=img.imageHeight*scale
    return img

def build(payload):
    report=payload.get('sourceReport');entries=payload['entries'];settings=payload.get('reportSettings') or {}
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
    story=[paragraph(title,styles['Title']),paragraph(company,styles['Heading2'])]
    if report:story.append(paragraph('The preceding pages preserve the original issued audit report. This appendix contains subsequent records and workflow updates from the Audit webapp.',styles['AuditBody']))
    else:
        story.append(paragraph((settings.get('auditConfidentiality') or 'Private & Confidential')+' | '+str(len(entries))+' findings',styles['AuditBody']))
        for label,key in [('Location','auditLocation'),('Prepared by','auditPreparedBy'),('Period start','auditPeriodStart'),('Period end','auditPeriodEnd'),('Issue date','auditIssueDate')]:
            if settings.get(key):story.append(paragraph(label+': '+settings[key],styles['AuditBody']))

    for e in additional+tracked:
        story.extend([Spacer(1,14),paragraph(e.get('reference') or e.get('department'),styles['Heading2'])])
        if e in additional:
            for title,key in [('Company','entity'),('Observations / Findings','finding'),('Impact','impact'),('Recommendation','recommendation'),('Status','status')]:story.extend([paragraph(title,styles['Heading3']),paragraph(e.get(key),styles['AuditBody'])])
        else:story.append(paragraph('Original source issue '+str(e['sourceReport']['issue'])+'; pages '+', '.join(map(str,e['sourceReport']['pages'])),styles['AuditBody']))
        if e in additional:
            for item in e.get('observationImages') or ([{'url':e.get('photoUrl'),'dataUrl':e.get('photoDataUrl'),'name':e.get('photoName')}] if e.get('photoUrl') or e.get('photoDataUrl') else []):
                img=evidence_image(item)
                if img:story.extend([img,paragraph(item.get('description') or item.get('name') or 'Evidence',styles['AuditBody'])])
        for n,a in enumerate(e.get('actions',[]),1):
            story.extend([paragraph('Corrective action '+str(n),styles['Heading3']),paragraph(a.get('description'),styles['AuditBody']),paragraph('Responsible person: '+a.get('owner','')+' | Email: '+a.get('email','')+' | Due: '+a.get('dueDate','')+' | Status: '+a.get('status',''),styles['AuditBody'])])
            for r in a.get('responses',[]):
                story.extend([paragraph('Update by '+r.get('author','')+' | '+r.get('createdAt','')+' | Status: '+r.get('status','')+' | Follow-up due: '+r.get('dueDate',''),styles['Heading3']),paragraph(r.get('text'),styles['AuditBody'])])
                for item in r.get('images',[]):
                    img=evidence_image(item)
                    if img:story.extend([img,paragraph(item.get('description') or item.get('name') or 'Action evidence',styles['AuditBody'])])
    buffer=BytesIO();SimpleDocTemplate(buffer,pagesize=(width,height),leftMargin=55,rightMargin=55,topMargin=55,bottomMargin=55).build(story)
    writer=PdfWriter();
    if reader:writer.append(reader)
    writer.append(PdfReader(BytesIO(buffer.getvalue())))
    result=BytesIO();writer.write(result);return result.getvalue()

if __name__=='__main__':sys.stdout.buffer.write(build(json.loads(sys.stdin.read())))
