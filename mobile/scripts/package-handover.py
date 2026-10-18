"""Create a source-only programmer ZIP from an explicit allowlist, never runtime data."""
from pathlib import Path
import hashlib, json, shutil, subprocess, sys, zipfile
root = Path(__file__).resolve().parents[2]
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=False)
files = []
for base in ('mobile/web', 'mobile/android/app/src', 'standalone-audit/vendor'):
    files += [p.relative_to(root) for p in (root/base).rglob('*') if p.is_file()]
for base, names in {
    'mobile': ['README.md', 'PROGRAMMER-HANDOVER.md'],
    'mobile/scripts': ['test-server.mjs', 'package-handover.py'],
    'mobile/android': ['build.gradle', 'settings.gradle', 'gradle.properties', 'gradlew', 'gradlew.bat', 'gradle/wrapper/gradle-wrapper.jar', 'gradle/wrapper/gradle-wrapper.properties', 'app/build.gradle'],
    'audit': ['text-format.mjs', 'audit-permissions.mjs', 'mobile-sync.mjs', 'audit-store.mjs', 'render_audit_pdf.py'],
    'standalone-audit': ['server.mjs', 'company-config.mjs', 'timezone.mjs', 'notifications.mjs', 'send_mail.py', 'query-store.mjs', 'query_index.py', 'report-data.mjs', 'login-page.mjs', 'app.js', 'styles.css', 'index.html', 'render_source_report.py'],
    'standalone-audit/scripts': ['import-source-reports.mjs'],
    'tests': ['mobile-sync.test.mjs', 'audit-response-evidence.test.mjs', 'audit-company-config.test.mjs', 'audit-drafts-notifications.test.mjs', 'mobile-browser.mjs'],
    'public': ['agrinexus-favicon-32.png', 'apple-touch-icon.png', 'agrinexus-logo.jpeg'],
}.items():
    files += [Path(base)/name for name in names]
for rel in files:
    target=out/rel
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root/rel, target)
# Reference backend: omit historical report seed records and isolate database environment.
p=out/'audit/audit-store.mjs'
s=p.read_text()
a=s.index('export const auditSeedEntries2025 = [')
b=s.index('let mongoClientPromise = null;')
s=s[:a]+'// Historical report records omitted from programmer handover.\nexport const auditSeedEntries2025 = [];\nexport const auditSeedEntries2024 = [];\n\n'+s[b:]
s=s.replace('process.env.FM2_MONGODB_URI || process.env.MONGODB_URI', 'process.env.AUDIT_MONGODB_URI')
s=s.replace('  } catch {\n    return [];\n  }','  } catch (error) {\n    if (error.code !== "ENOENT") throw error;\n    return [];\n  }')
s=s.replace('  } catch {\n    existing = [];\n  }','  } catch (error) {\n    if (error.code !== "ENOENT") throw error;\n    existing = [];\n  }')
s=s.replace('  await fs.writeFile(file, JSON.stringify([...others, ...entries], null, 2) + "\\n");','  const temp = file + ".tmp";\n  await fs.writeFile(temp, JSON.stringify([...others, ...entries], null, 2) + "\\n", {mode:0o600});\n  await fs.rename(temp,file);')
p.write_text(s)
(out/'README.md').write_text('# Audit mobile source package\n\nStart with [the programmer handover](mobile/PROGRAMMER-HANDOVER.md).\n\nOpen `mobile/android` in Android Studio. The default host is `audit.digitalpalm.ai`. This is a test build with the same webapp login, roles and company permissions.\n')
(out/'package.json').write_text(json.dumps({'name':'audit-mobile-programmer-handover','private':True,'type':'module','scripts':{'test':'node --test tests/*.test.mjs','test:server':'node mobile/scripts/test-server.mjs','test:browser':'node tests/mobile-browser.mjs'}},indent=2)+'\n')
(out/'.gitignore').write_text('node_modules/\n**/build/\n**/.gradle/\n**/local.properties\nstandalone-audit/runtime/\n*.apk\n*.jks\n*.keystore\n.env*\n')
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
manifest={'baseRevision':revision,'includesWorkingTreeChanges':True,'note':'Android defaults/wrapper/docs/tests updated for this handover. Packaged audit-store.mjs has no historical seed records and uses standalone store configuration. No production runtime or credentials included.','files':{}}
for p in sorted(out.rglob('*')):
    if p.is_file(): manifest['files'][str(p.relative_to(out))]=hashlib.sha256(p.read_bytes()).hexdigest()
(out/'SOURCE-MANIFEST.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=out.with_suffix('.zip')
with zipfile.ZipFile(archive,'x',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(out.rglob('*')):
        if p.is_file(): z.write(p,str(Path(out.name)/p.relative_to(out)))
print(str(archive))
print('SHA256 '+hashlib.sha256(archive.read_bytes()).hexdigest())
print(str(len(manifest['files'])+1)+' files')
