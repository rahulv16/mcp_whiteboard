import {createHash,timingSafeEqual} from 'node:crypto';
export function createAuth({token='',host='127.0.0.1',publicUrl='',port=4180}){
  if(host!=='127.0.0.1' && (!publicUrl||!token))throw Error('Non-loopback hosting requires WHITEBOARD_PUBLIC_URL and WHITEBOARD_TOKEN.');
  if(token && token.length<32)throw Error('WHITEBOARD_TOKEN must have at least 32 characters.');
  const external=publicUrl?new URL(publicUrl):null;
  if(external && (external.protocol!=='https:' || external.username || external.password || external.pathname!=='/'))throw Error('WHITEBOARD_PUBLIC_URL must be an HTTPS origin.');
  const digest=value=>createHash('sha256').update(value).digest();
  const session=token?createHash('sha256').update('whiteboard-browser-session:'+token).digest('hex'):'';
  const equal=(left,right)=>typeof left==='string'&&timingSafeEqual(digest(left),digest(right));
  return {
    enabled:!!token,
    validOrigin(request){const hosts=[`127.0.0.1:${port}`,`localhost:${port}`,...(external?[external.host]:[])];const origins=[`http://127.0.0.1:${port}`,`http://localhost:${port}`,...(external?[external.origin]:[])];return hosts.includes(request.headers.host)&&(!request.headers.origin||origins.includes(request.headers.origin));},
    bearer(request){return !!token&&equal(request.headers.authorization,'Bearer '+token);},
    allowed(request){if(!token)return true;if(this.bearer(request))return true;const cookie=(request.headers.cookie||'').split(';').map(value=>value.trim()).find(value=>value.startsWith('whiteboard_session='));return !!cookie&&equal(cookie.slice('whiteboard_session='.length),session);},
    cookie:`whiteboard_session=${session}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${external?'; Secure':''}`
  };
}
