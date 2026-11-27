#!/usr/bin/env python3
"""Builds docs/Encalm-Projects-Handover-Guide.docx from docs/HANDOVER.md.

Run after changing HANDOVER.md, so the Word copy stays the same:
    python3 docs/build-handover-docx.py
Needs pandoc and python-docx (pip install python-docx).
"""
import os, subprocess, sys, tempfile, datetime
from docx import Document
from docx.shared import Pt, RGBColor, Cm
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.enum.text import WD_ALIGN_PARAGRAPH

REPO=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D=tempfile.mkdtemp()
OUT=os.path.join(REPO,'docs','Encalm-Projects-Handover-Guide.docx')
commit=subprocess.run(['git','-C',REPO,'rev-parse','--short','HEAD'],capture_output=True,text=True).stdout.strip() or 'unknown'
GH='https://github.com/digitalintern123/Project-Dashboard/blob/main/'
md=open(f'{REPO}/docs/HANDOVER.md').read()
# Repo-relative links point to GitHub in the Word copy.
md=md.replace('](../PRODUCTION.md)', f']({GH}PRODUCTION.md)').replace('](USER_MANUAL.md)', f']({GH}docs/USER_MANUAL.md)')
# Title is drawn on the cover page instead.
md=md.split('\n',1)[1]
open(f'{D}/in.md','w').write(md)
subprocess.run(['pandoc','-f','gfm','-t','docx','-o',f'{D}/raw.docx',f'{D}/in.md'],check=True)

TEAL=RGBColor(0x17,0x3e,0x49); GREEN=RGBColor(0x2e,0x7c,0x67); GOLD=RGBColor(0x9a,0x71,0x1f)
doc=Document(f'{D}/raw.docx')
st={x.name:x for x in doc.styles}
def font(style,name='Calibri',size=None,color=None,bold=None):
    s=st[style]; s.font.name=name
    s.element.rPr.rFonts.set(qn('w:eastAsia'),name) if s.element.rPr is not None and s.element.rPr.rFonts is not None else None
    if size: s.font.size=Pt(size)
    if color is not None: s.font.color.rgb=color
    if bold is not None: s.font.bold=bold
for n in ['Normal','Body Text','First Paragraph','Compact']:
    if n in st: font(n,size=11)
for n,sz,c in [('Heading 1',20,TEAL),('Heading 2',14,TEAL),('Heading 3',12,GREEN)]:
    font(n,size=sz,color=c,bold=True)
    pf=st[n].paragraph_format; pf.space_before=Pt(18 if n=='Heading 1' else 12); pf.space_after=Pt(6); pf.keep_with_next=True
if 'Source Code' in st:
    font('Source Code','Consolas',8.5)
for n in ['Verbatim Char']:
    if n in st: font(n,'Consolas',9.5,GREEN)
if 'Hyperlink' in st: st['Hyperlink'].font.color.rgb=GREEN

def shade(el,fill):
    pr=el.get_or_add_tcPr() if hasattr(el,'get_or_add_tcPr') else el
    sh=OxmlElement('w:shd'); sh.set(qn('w:val'),'clear'); sh.set(qn('w:color'),'auto'); sh.set(qn('w:fill'),fill); pr.append(sh)

# Code blocks: light grey box.
for p in doc.paragraphs:
    if p.style.name=='Source Code':
        ppr=p._p.get_or_add_pPr(); shade(ppr,'F3F1EA')
        p.paragraph_format.left_indent=Cm(0.2)
    if p.style.name in ('Block Text',):
        ppr=p._p.get_or_add_pPr(); shade(ppr,'FBF1D8')
        for r in p.runs: r.font.color.rgb=GOLD

# Tables: borders, teal header row, full width.
for t in doc.tables:
    tbl=t._tbl; tblPr=tbl.tblPr
    b=OxmlElement('w:tblBorders')
    for side in ['top','left','bottom','right','insideH','insideV']:
        e=OxmlElement(f'w:{side}'); e.set(qn('w:val'),'single'); e.set(qn('w:sz'),'4'); e.set(qn('w:color'),'C9C3B4'); b.append(e)
    tblPr.append(b)
    w=OxmlElement('w:tblW'); w.set(qn('w:w'),'5000'); w.set(qn('w:type'),'pct')
    for old in tblPr.findall(qn('w:tblW')): tblPr.remove(old)
    tblPr.append(w)
    for i,row in enumerate(t.rows):
        for cell in row.cells:
            if i==0: shade(cell._tc,'173E49')
            for p in cell.paragraphs:
                p.paragraph_format.space_after=Pt(2); p.paragraph_format.space_before=Pt(2)
                for r in p.runs:
                    r.font.size=Pt(9.5)
                    if i==0: r.font.color.rgb=RGBColor(0xff,0xff,0xff); r.font.bold=True
    # header row repeats on new pages
    trPr=t.rows[0]._tr.get_or_add_trPr(); h=OxmlElement('w:tblHeader'); h.set(qn('w:val'),'true'); trPr.append(h)

# Part A / Part B start on a new page.
for p in doc.paragraphs:
    if p.style.name=='Heading 1' and p.text.startswith('Part '):
        p.paragraph_format.page_break_before=True

# Cover page.
body=doc.element.body; first=doc.paragraphs[0]
def before(text,size,color,bold=False,space=6,align=None):
    np=first.insert_paragraph_before(); r=np.add_run(text); r.font.size=Pt(size); r.font.color.rgb=color; r.font.bold=bold; r.font.name='Calibri'
    np.paragraph_format.space_after=Pt(space)
    if align: np.alignment=align
    return np
for _ in range(6): first.insert_paragraph_before()
before('ENCALM HOSPITALITY',11,GOLD,True,4)
before('Encalm Projects',30,TEAL,True,2)
before('Handover and Maintenance Guide',20,GREEN,False,24)
before('projects.encalmhospitality.com',12,TEAL,False,40)
today=datetime.date.today().strftime('%d %B %Y')
before(f'Version: {today}  ·  matches code commit {commit}',10,RGBColor(0x69,0x71,0x6b))
before('Part A: business owner  ·  Part B: IT',10,RGBColor(0x69,0x71,0x6b))
before('Confidential: internal use only. Contains no passwords; secrets are kept in the company password manager.',9,RGBColor(0x69,0x71,0x6b),space=0)
pb=first.insert_paragraph_before(); pb.add_run().add_break(__import__('docx').enum.text.WD_BREAK.PAGE)

# Page setup, footer with page numbers.
for s in doc.sections:
    s.page_height=Cm(29.7); s.page_width=Cm(21); s.left_margin=s.right_margin=Cm(2); s.top_margin=s.bottom_margin=Cm(2)
    fp=s.footer.paragraphs[0]; fp.alignment=WD_ALIGN_PARAGRAPH.CENTER
    r=fp.add_run('Encalm Projects · Handover Guide · page '); r.font.size=Pt(8); r.font.color.rgb=RGBColor(0x69,0x71,0x6b)
    r2=fp.add_run(); r2.font.size=Pt(8)
    for tag,txt in [('begin',None),(None,'PAGE'),('end',None)]:
        if tag:
            f=OxmlElement('w:fldChar'); f.set(qn('w:fldCharType'),tag); r2._r.append(f)
        else:
            it=OxmlElement('w:instrText'); it.set(qn('xml:space'),'preserve'); it.text=txt; r2._r.append(it)
doc.core_properties.title='Encalm Projects: Handover and Maintenance Guide'
doc.core_properties.author='Encalm Hospitality'
doc.save(OUT)
print(OUT)
