const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const W=3000,WT=[55,30,12,3],MAXO=520;
const html=fs.readFileSync(path.join(__dirname,'index.html'));
const server=http.createServer((q,s)=>{
  if(q.url==='/health'){s.end('ok');return}
  s.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});s.end(html);
});
const wss=new WebSocketServer({server});
let nid=1,orbs=new Map(),players=new Map(),add=[],rem=[];
const rnd=(a,b)=>a+Math.random()*(b-a);
const num=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)||0));
function pickType(){let t=Math.random()*100;for(let i=0;i<4;i++){if((t-=WT[i])<0)return i}return 0}
function addOrb(x,y,t){const o={id:nid++,x:Math.round(num(x,5,W-5)),y:Math.round(num(y,5,W-5)),t:t??pickType()};orbs.set(o.id,o);add.push([o.id,o.x,o.y,o.t])}
for(let i=0;i<500;i++)addOrb(rnd(30,W-30),rnd(30,W-30));
add=[];

wss.on('connection',ws=>{
  const id='p'+nid++;
  const p={id,ws,x:0,y:0,dead:true,u:null};
  players.set(id,p);
  ws.isAlive=true;ws.on('pong',()=>{ws.isAlive=true});
  ws.send(JSON.stringify({t:'init',id,o:[...orbs.values()].map(o=>[o.id,o.x,o.y,o.t])}));
  ws.on('message',raw=>{
    if(raw.length>6000)return;
    let m;try{m=JSON.parse(raw)}catch(e){return}
    if(m.t==='j'){p.dead=false;p.u=null}
    else if(m.t==='u'&&!p.dead&&Array.isArray(m.q)){
      p.x=num(m.x,0,W);p.y=num(m.y,0,W);
      const q=m.q.slice(0,100).map(v=>Math.round(num(v,0,W)));
      p.u=[id,p.x,p.y,num(m.a,-7,7),num(m.xp,0,1e6),num(m.c,0,360),num(m.s,0,100),m.r?1:0,num(m.h,0,20),m.g?1:0,q];
    }
    else if(m.t==='e'){
      const o=orbs.get(m.id);
      if(o&&!p.dead&&Math.hypot(o.x-p.x,o.y-p.y)<160){
        orbs.delete(o.id);rem.push(o.id);
        if(orbs.size<MAXO)addOrb(rnd(30,W-30),rnd(30,W-30));
      }
    }
    else if(m.t==='d'){
      if(!p.dead&&p.u){const q=p.u[10];for(let i=0;i+1<q.length;i+=2)addOrb(q[i]+rnd(-8,8),q[i+1]+rnd(-8,8),1)}
      p.dead=true;p.u=null;
    }
    else if(m.t==='l'){p.dead=true;p.u=null}
  });
  ws.on('close',()=>players.delete(id));
});

setInterval(()=>{
  const pl=[];
  for(const p of players.values())if(!p.dead&&p.u)pl.push(p.u);
  const msg=JSON.stringify({t:'s',p:pl,o:add,r:rem});
  add=[];rem=[];
  for(const p of players.values())if(p.ws.readyState===1)p.ws.send(msg);
},66);
setInterval(()=>{wss.clients.forEach(ws=>{if(!ws.isAlive)return ws.terminate();ws.isAlive=false;ws.ping()})},30000);
server.listen(process.env.PORT||3000,()=>console.log('Сервер запущен'));
