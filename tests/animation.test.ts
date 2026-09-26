import {describe,it,expect} from 'vitest';
import {Group} from 'three';
import {animateVehicle,type Model} from '../src/models';
const vehicle=()=>{const model=new Group() as Model;model.userData.wheels=[new Group()];return model;};
describe('vehicle animation continuity',()=>{
 it('does not teleport wheel rotation when speed changes at the same instant',()=>{const model=vehicle();for(let i=0;i<=60;i++)animateVehicle(model,i/60,10);const angle=model.userData.wheels![0].rotation.x;animateVehicle(model,1,1);expect(model.userData.wheels![0].rotation.x).toBeCloseTo(angle,8);});
 it('integrates matching travel consistently at 30 and 60 frames per second',()=>{const a=vehicle(),b=vehicle();for(let i=0;i<=30;i++)animateVehicle(a,i/30,5);for(let i=0;i<=60;i++)animateVehicle(b,i/60,5);expect(a.userData.wheels![0].rotation.x).toBeCloseTo(b.userData.wheels![0].rotation.x,8);expect(a.userData.wheels![0].rotation.x).toBeGreaterThan(0);});
});
