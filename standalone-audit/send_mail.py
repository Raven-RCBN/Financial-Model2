"""SMTP delivery for the private Audit queue. Secrets are read only from environment."""
import json, os, smtplib, ssl, sys
from email.message import EmailMessage
from email.utils import formatdate
job = json.load(sys.stdin)
msg = EmailMessage()
msg['From'] = os.environ['AUDIT_MAIL_FROM']
msg['To'] = job['to']
msg['Subject'] = job['subject']
msg['Date'] = formatdate(localtime=False)
msg['Message-ID'] = '<audit-' + job['key'] + '@audit.digitalpalm.ai>'
msg.set_content(job['text'])
host = os.environ['AUDIT_SMTP_HOST']
mode = os.environ.get('AUDIT_SMTP_SECURITY', 'starttls')
if mode not in ('ssl', 'starttls'):
    raise ValueError('Use ssl or starttls for SMTP')
port = int(os.environ.get('AUDIT_SMTP_PORT', '465' if mode == 'ssl' else '587'))
context = ssl.create_default_context()
if mode == 'ssl':
    smtp = smtplib.SMTP_SSL(host, port, timeout=30, context=context)
else:
    smtp = smtplib.SMTP(host, port, timeout=30)
with smtp:
    if mode == 'starttls':
        smtp.starttls(context=context)
    if os.environ.get('AUDIT_SMTP_USERNAME'):
        smtp.login(os.environ['AUDIT_SMTP_USERNAME'], os.environ['AUDIT_SMTP_PASSWORD'])
    smtp.send_message(msg)
