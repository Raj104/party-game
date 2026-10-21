const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const ts=require('typescript');

const source=readFileSync(path.join(__dirname,'../../client/src/games/LastWord/bombFlightPath.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const flightModule={exports:{}};
new Function('module','exports',compiled)(flightModule,flightModule.exports);
const {bombFlightWaypoints}=flightModule.exports;

const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<0.001,`expected ${actual} near ${expected}`);
function radialDistance({x,y}) {return Math.hypot((x-50)/43,(y-50)/39);}

test('3-player wrap-around follows the left perimeter, never back to center',()=>{
  const points=bombFlightWaypoints(['top','right','left'],'left','top');
  assert.equal(points.length,13);
  near(points[0].x,50-43*Math.sqrt(3)/2);
  near(points.at(-1).x,50);
  near(points.at(-1).y,11);
  assert.ok(points[6].x<12,'left-to-top flight should curve around the left edge');
  assert.ok(points.every(p=>radialDistance(p)>0.999),'normal handoffs must not cut inside the ring');
});

test('all clockwise neighboring handoffs stay outside the center, including 6-to-1 wrap',()=>{
  for(const count of [2,3,4,5,6]) {
    const order=Array.from({length:count},(_,i)=>`p${i}`);
    for(let i=0;i<count;i++) {
      const points=bombFlightWaypoints(order,order[i],order[(i+1)%count]);
      assert.equal(points.length,13);
      assert.ok(points.every(p=>radialDistance(p)>=0.999),`count=${count}, hop=${i} cuts inward`);
      assert.ok(points.slice(1,-1).some(p=>radialDistance(p)>1.01),'flight should bow out beyond seat ring');
    }
  }
});

test('two-player clockwise passes alternate sides instead of crossing center',()=>{
  const down=bombFlightWaypoints(['top','bottom'],'top','bottom');
  const up=bombFlightWaypoints(['top','bottom'],'bottom','top');
  assert.ok(down[6].x>90);
  assert.ok(up[6].x<10);
});

test('only center-origin respawn/initial flights begin at center',()=>{
  const order=['a','b','c'];
  for(const source of [null,'eliminated']) {
    const points=bombFlightWaypoints(order,source,'b');
    near(points[0].x,50);near(points[0].y,50);
    assert.ok(points.at(-1).x>85);
  }
  const normal=bombFlightWaypoints(order,'a','b');
  assert.notDeepEqual(normal[0],{x:50,y:50});
});


test('initial and post-BOOM center launches move in a straight line to every seat',()=>{
  for(const count of [2,3,4,5,6]) {
    const order=Array.from({length:count},(_,i)=>`p${i}`);
    for(const targetId of order) {
      for(const sourceId of [null,'eliminated']) {
        const points=bombFlightWaypoints(order,sourceId,targetId);
        const destination=points.at(-1);
        points.forEach((point,i)=>{
          const t=i/(points.length-1);
          near(point.x,50+(destination.x-50)*t);
          near(point.y,50+(destination.y-50)*t);
        });
      }
    }
  }
});

test('normal player-to-player hop remains a curved perimeter flight',()=>{
  const order=['a','b','c'];
  const points=bombFlightWaypoints(order,'a','b');
  assert.ok(points.every(point=>radialDistance(point)>=0.999));
  assert.ok(points.slice(1,-1).some(point=>radialDistance(point)>1.01));
});
