import {randomBytes} from 'node:crypto';
import {writeFileSync} from 'node:fs';
try{
 writeFileSync('.env',`POSTGRES_PASSWORD=${randomBytes(32).toString('hex')}\nAPP_PORT=3000\n`,{flag:'wx',mode:0o600});
 console.log('.env creado con una contraseña aleatoria. No se muestra ni se incluye en Git.');
}catch(e){if(e.code==='EEXIST')console.log('.env ya existe; se conserva sin cambios.');else throw e;}
