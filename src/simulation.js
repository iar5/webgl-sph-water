/**
 * @author Tom Wendland
 * SPH simulation solver
 * */

import * as Vec3 from '../lib/twgl/v3.js'
import { Drop } from './objects/Drop.js'
import { Sphere } from './objects/Sphere.js'
import { Pool } from './objects/Pool.js'
import { Emitter } from './objects/Emitter.js'


const TIMESTEP = 0.00002 // dt
const EXTERNAL_FORCES = [0, -9.81*10000, 0] // m/s
const REST_DENS = 1000 // dichte von wasser 993 kg/m^3
const GAS_CONST = 2000 // stiffness, Nm/kg
const VISC = 0.5 // Ns/m^2
const PARTICLE_MASS = 0.0002 // kg
const PARTICLE_RADIUS = 0.03 // m
const drops = Emitter.createDropCube(Vec3.create(0, 1, 0), 10, 14, 10, PARTICLE_RADIUS*2)

// optimization: precalculate constant values 
const H = PARTICLE_RADIUS*2 // kernel radius
const H2 = H*H

// optimization: predeclare vec3s and reuse them in code
const rij = Vec3.create() // difference between drop i and j
const rvij = Vec3.create() // difference in velocity between drop i and j
const fpress = Vec3.create() // pressure force
const fvisc = Vec3.create() // viscosity force
const fgrav = Vec3.create() // grav force
const f = Vec3.create() // force sum
const v = Vec3.create() // velocity
const x = Vec3.create() // position

const pool = new Pool(Vec3.create(), 2, 3, 1)
const sphere = new Sphere(Vec3.create(0, 0, 0), 0.4)
const emitter = new Emitter(Vec3.create(-1, 1.5, 0), drops, 1, 0.5, 0, Vec3.create(300, 0, 0))


/**
 * MAIN CALCULATION
 * 
 */
function update(){ 

    sphere.update()
    //emitter.update()

    // density (rho) at particle positions
    // pressure (p) at particle positions via gas equation
    for(let di of drops){
        di.rho = 0
        for(let dj of drops){
            let r2 = Vec3.distanceSq(di.pos, dj.pos)
            if(r2 < H2){
                // rho += PARTICLE_MASS * W
                di.rho += PARTICLE_MASS * poly6(r2)
            }
        }
        di.p = GAS_CONST * (di.rho - REST_DENS);
    }

    // Navier Stokes pressure and visc force contributions
    for(let pi of drops){
        Vec3.reset(f)
        Vec3.reset(fgrav)
        Vec3.reset(fpress)
        Vec3.reset(fvisc)

        for(let pj of drops){
            if(pi === pj) continue

            Vec3.subtract(pj.pos, pi.pos, rij)
            let r = Vec3.length(rij)

            if(r < H){
                //fpress += - MASS * rij.normalized() * (pi.p+pj.p)/(2.f*pj.rho) * W;
                Vec3.normalize(rij, rij)
                Vec3.mulScalar(rij, - PARTICLE_MASS * (pi.p + pj.p)/(2*pj.rho) * spiky(r), rij)
                Vec3.add(fpress, rij, fpress)

                //fvisc += VISC * MASS * (pj.v-pi.v) / pj.rho * W;
                Vec3.subtract(pj.v, pi.v, rvij)
                Vec3.mulScalar(rvij, VISC * PARTICLE_MASS * 1/pj.rho * visc(r), rvij)
                Vec3.add(fvisc, rvij, fvisc)
            }
        }

        Vec3.mulScalar(EXTERNAL_FORCES, pi.rho, fgrav)
        Vec3.add(f, fgrav, f)
        Vec3.add(f, fpress, f)
        Vec3.add(f, fvisc, f)
        Vec3.copy(f, pi.f)
    }

    // collisions
    for(let p of drops){
        pool.collide(p)
        sphere.collide(p)
    }

    // numerical integration forward euler
    for(let p of drops){
        // p.v += DT*p.f/p.rho;
        Vec3.mulScalar(p.f, TIMESTEP/p.rho, v) 
        Vec3.add(p.v, v, p.v)

        // p.x += DT*p.v;
        Vec3.mulScalar(p.v, TIMESTEP, x)
        Vec3.add(p.pos, x, p.pos)
    }
}


const POLY6 = 315/(65*Math.PI*Math.pow(H,9))
const SPIKY_GRAD = -45/(Math.PI*Math.pow(H,6))
const VISC_LAP = 45/(Math.PI*Math.pow(H,6))

function poly6(r2){
    return POLY6 * Math.pow(H2-r2, 3)
}

function spiky(r){
    return SPIKY_GRAD * Math.pow(H-r, 2)
}

function visc(r){
    return VISC_LAP * (H-r)
}


/**
 * PUBLIC FUNCTIONS
 */
export const simulation = (function(){

    return {
        update,
        getDrops(){
            return drops
        },
        getSphere(){
            return sphere 
        },
    }
})()



