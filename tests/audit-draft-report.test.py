import unittest,importlib.util,io
from pathlib import Path
from pypdf import PdfReader
spec=importlib.util.spec_from_file_location('renderer',Path(__file__).resolve().parents[1]/'standalone-audit/render_source_report.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
class DraftReportTests(unittest.TestCase):
 def test_grouping_and_draft_labels(self):
  entries=[dict(id='2',department='Security',status='Draft',finding='Second department',actions=[]),dict(id='1',department='Fleet',status='Draft',finding='First department',actions=[dict(description='Inspect vehicle',owner='Tester',email='test@example.test',dueDate='')])]
  pdf=PdfReader(io.BytesIO(r.build(dict(entries=entries,draftReport=True,auditEntity='Sample',reportSettings={'auditReportTitle':'2026 Internal Audit Report'}))))
  text='\n'.join(p.extract_text() for p in pdf.pages)
  self.assertEqual(len(pdf.pages),4)
  self.assertLess(text.index('First department'),text.index('Second department'))
  self.assertEqual(text.count('Inspect vehicle'),1)
  self.assertTrue(all('DRAFT' in p.extract_text() for p in pdf.pages))
 def test_final_not_marked_draft(self):
  pdf=PdfReader(io.BytesIO(r.build(dict(entries=[dict(id='1',department='Fleet',finding='Final finding')],auditEntity='Sample'))))
  self.assertNotIn('DRAFT',''.join(p.extract_text() for p in pdf.pages))
if __name__=='__main__':unittest.main()
