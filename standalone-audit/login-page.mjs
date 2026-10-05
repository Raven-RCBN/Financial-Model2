export function loginPage(error = '') {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#164b35">
  <title>Sign in · AgIntel Audit</title>
  <style>
    :root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#193d2d;background:#f4f6f1;font-synthesis:none}
    *{box-sizing:border-box}body{margin:0}a{color:#225a40;text-underline-offset:4px}a:hover{color:#123923}
    .shell{min-height:100svh;display:grid;grid-template-columns:1fr 1fr;padding:24px;gap:24px}
    .intro{background:#164b35;color:#f7faf5;border-radius:20px;padding:clamp(32px,5vw,80px);display:flex;flex-direction:column;justify-content:space-between;min-height:640px;position:relative;overflow:hidden}
    .brand{display:flex;align-items:center;gap:13px;font-size:19px;letter-spacing:.02em}.mark{display:grid;place-items:center;width:42px;height:42px;border:1px solid #8da58e;border-radius:12px;color:#edc76e;font-size:27px;font-weight:400}
    .intro-content{max-width:460px;padding:65px 0}.eyebrow{text-transform:uppercase;font-size:11px;letter-spacing:.15em;color:#edc76e;margin:0 0 22px}
    h1{font-size:clamp(36px,4vw,58px);font-weight:400;line-height:1.12;letter-spacing:-.035em;margin:0 0 24px}.intro p:not(.eyebrow){font-size:16px;line-height:1.8;color:#d1dfd3;margin:0;max-width:390px}
    .steps{display:flex;gap:20px;flex-wrap:wrap;border-top:1px solid #52745e;padding-top:25px;font-size:12px;color:#dae5d9}.steps span{display:flex;gap:9px}.steps i{font-style:normal;color:#edc76e}
    .signin{display:flex;align-items:center;justify-content:center;padding:48px 24px}.card{width:100%;max-width:380px}.label{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:#758471;margin:0 0 18px}
    h2{font-size:32px;font-weight:400;letter-spacing:-.025em;margin:0 0 12px}.description{font-size:14px;line-height:1.7;color:#647267;margin:0 0 32px}
    form{display:grid;gap:22px}label{display:grid;gap:9px;font-size:13px}input{width:100%;font:inherit;font-size:16px;border:1px solid #c8d3c6;border-radius:8px;background:#fff;color:#193d2d;padding:14px 15px;min-height:50px}
    input:focus{outline:2px solid #547d5f;outline-offset:2px}button{font:inherit;font-size:15px;font-weight:500;background:#20543c;color:white;border:0;border-radius:8px;padding:15px;min-height:50px;cursor:pointer;margin-top:3px}button:hover{background:#153f2c}button:focus-visible,a:focus-visible{outline:3px solid #b08023;outline-offset:4px}
    .help{font-size:12px;line-height:1.7;color:#687568;margin:20px 0 0}.mobile{border-top:1px solid #d9dfd3;margin-top:32px;padding-top:25px;font-size:13px;line-height:1.7}.mobile p{color:#687568;margin:8px 0 0;font-size:12px}
    .error{background:#fff0ec;border:1px solid #e7bcb2;border-radius:8px;color:#8f3529;font-size:13px;line-height:1.6;padding:12px 14px;margin:0 0 24px}
    @media(max-width:760px){.shell{grid-template-columns:1fr;padding:12px;gap:0}.intro{min-height:0;padding:26px;border-radius:14px}.intro-content{padding:35px 0 4px}.intro-content h1{font-size:32px;max-width:340px;margin-bottom:12px}.intro-content p:not(.eyebrow),.steps{display:none}.eyebrow{margin-bottom:12px}.signin{padding:40px 18px}.brand{font-size:17px}.mark{width:35px;height:35px;font-size:23px}}
  </style>
</head>
<body>
  <main class="shell">
    <section class="intro" aria-label="AgIntel Audit">
      <div class="brand"><span class="mark" aria-hidden="true">a</span><span>AgIntel Audit</span></div>
      <div class="intro-content"><p class="eyebrow">Clarity from finding to follow-up</p><h1>Every observation.<br>A clear next step.</h1><p>Record findings, assign corrective actions and follow progress in one shared audit workspace.</p></div>
      <div class="steps" aria-label="Audit workflow"><span><i>01</i> Observe</span><span><i>02</i> Take action</span><span><i>03</i> Follow up</span></div>
    </section>
    <section class="signin" aria-labelledby="signin-title"><div class="card">
      <p class="label">Your audit workspace</p><h2 id="signin-title">Welcome back</h2><p class="description">Sign in with your Audit account to continue.</p>
      ${error ? '<p class="error" role="alert">Unable to sign in. Check your username and password, or contact your Audit administrator.</p>' : ''}
      <form method="post" action="/login">
        <label for="userid">Username<input id="userid" name="userid" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label for="password">Password<input id="password" name="password" type="password" autocomplete="current-password" required></label>
        <button type="submit">Sign in</button>
      </form>
      <p class="help">Need access or a password reset? Contact your Audit administrator.</p>
      <div class="mobile"><a href="/mobile-app/index.html">Open mobile &amp; offline workspace <span aria-hidden="true">↗</span></a><p>Sign in online and download your workspace before working offline.</p></div>
    </div></section>
  </main>
</body>
</html>`;
}
