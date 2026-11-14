import crypto from 'node:crypto';
const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function passwordPage(message='',verify=false){
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Change password · Audit</title><style>body{font:16px system-ui;background:#f3f7f2;color:#214c32;margin:0}main{max-width:440px;margin:60px auto;background:white;padding:30px;border:1px solid #d4dfd1;border-radius:16px}label,input,button{display:block;box-sizing:border-box;width:100%}label{margin:18px 0}input,button{padding:12px;margin-top:7px;border:1px solid #b8cbb5;border-radius:6px}button{background:#175c2c;color:white;font:inherit}a{color:#175c2c}</style><main><h1>Change password</h1><p>${escape(message)}</p><form method="post" action="/change-password">${verify?'<label>Email verification code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code" required></label><label>New password<input name="password" type="password" minlength="12" maxlength="256" autocomplete="new-password" required></label><label>Confirm new password<input name="confirm" type="password" minlength="12" maxlength="256" autocomplete="new-password" required></label><button>Verify email and change password</button>':'<label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required></label><button>Send email verification code</button>'}</form><p>Use at least 12 characters. Verification codes expire after 10 minutes.</p><a href="/login">Return to sign in</a></main></html>`;
}
export function passwordChallenges(){
 const pending=new Map(),sent=new Map();
 return {
  async begin(user,next,send){
   const now=Date.now();
   for(const [key,value] of pending)if(value.expiresAt<now)pending.delete(key);
   for(const [key,value] of sent)if(now-value>60000)sent.delete(key);
   if(sent.has(user.name))throw Error('A code was recently sent. Wait one minute before trying again.');
   if(pending.size>=1000)throw Error('Please try again shortly.');
   const id=crypto.randomBytes(32).toString('hex'),code=String(crypto.randomInt(100000,1000000));
   sent.set(user.name,now);
   await send({key:crypto.randomUUID(),to:user.email,subject:'Audit email verification',text:`Your Audit verification code is ${code}. It expires in 10 minutes. Enter it on the password-change screen.`});
   pending.set(id,{userId:user.name,email:user.email,authVersion:user.credential.salt,next,expiresAt:now+600000,attempts:0,digest:crypto.createHash('sha256').update(code).digest('hex')});
   return id;
  },
  get(id){const item=pending.get(id);if(!item||item.expiresAt<Date.now()){pending.delete(id);return null;}return item;},
  verify(id,code){const item=this.get(id);if(!item)return null;item.attempts++;if(item.attempts>5){pending.delete(id);return null;}const digest=crypto.createHash('sha256').update(String(code)).digest('hex');return crypto.timingSafeEqual(Buffer.from(digest),Buffer.from(item.digest))?item:null;},
  remove(id){pending.delete(id);}
 };
}
