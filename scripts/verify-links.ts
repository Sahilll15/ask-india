import { execFileSync } from 'node:child_process';
import { PORTALS } from '../app/lib/directory.ts';
import { hostOf, isOfficialUrl } from '../app/lib/domains.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
let failed = 0;
for (const [key, p] of Object.entries(PORTALS)) {
  let out = '000 ';
  try {
    out = execFileSync('curl', ['-sS', '-L', '-o', '/dev/null', '--max-time', '25', '-A', UA, '-w', '%{http_code} %{url_effective}', p.url], { encoding: 'utf8' });
  } catch {}
  const [code, finalUrl] = out.split(' ');
  const ok = code === '200' && isOfficialUrl(finalUrl);
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${code} ${key.padEnd(16)} ${p.url} -> ${hostOf(finalUrl) ?? finalUrl}`);
}
process.exitCode = failed ? 1 : 0;
