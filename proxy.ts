import {NextRequest,NextResponse} from 'next/server';
import {createHash,timingSafeEqual} from 'node:crypto';
function matches(a:string,b:string){return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());}
export function proxy(request:NextRequest){
 if(request.nextUrl.pathname==='/api/health')return NextResponse.next();
 const password=process.env.APP_PASSWORD,user=process.env.APP_USERNAME||'carlos';
 if(!password)return new NextResponse('Configura APP_PASSWORD para habilitar la aplicación.',{status:503});
 const auth=request.headers.get('authorization')||'';
 let provided='';try{if(auth.startsWith('Basic '))provided=Buffer.from(auth.slice(6),'base64').toString('utf8');}catch{}
 if(!matches(provided,`${user}:${password}`))return new NextResponse('Acceso privado a Aurum.',{status:401,headers:{'WWW-Authenticate':'Basic realm="Aurum", charset="UTF-8"','Cache-Control':'no-store'}});
 if(['POST','PUT','PATCH','DELETE'].includes(request.method)){
  const origin=request.headers.get('origin');
  if(origin&&origin!==request.nextUrl.origin)return NextResponse.json({error:'Origen no permitido.'},{status:403});
 }
 const response=NextResponse.next();response.headers.set('Cache-Control','no-store');return response;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
