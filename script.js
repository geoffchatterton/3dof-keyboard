
import * as THREE from 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.module.min.js';

let alpha = 0, beta = 0, gamma = 0;
let aRate = 0, bRate = 0, gRate = 0;
let xAcc = 0, yAcc = 0, zAcc = 0;

let rotationSpeed = 0;
let currentRotation = 0;
let lastTime = 0;


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75, 
  window.innerWidth / window.innerHeight, 
  0.1, 
  1000
);
camera.position.set(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Make sure CSS has:
// body, html { margin:0; padding:0; overflow:hidden; }
// canvas { position:fixed; top:0; left:0; width:100%; height:100%; }

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false);

// Cylinder geometry
const texture = new THREE.TextureLoader().load('./keyboard.png');
texture.wrapS = THREE.RepeatWrapping;
//texture.offset.x = 100;
//texture.repeat.x = -1; // flip horizontally

const cylinderGeometry = new THREE.CylinderGeometry(20, 20, 60, 32, 1, true);
cylinderGeometry.rotateX(-Math.PI / 2);

const cylinderMaterial = new THREE.MeshBasicMaterial({
  map: texture,
  side: THREE.BackSide
});
const cylinderMesh = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
// Or apply negative scale if you prefer:
// cylinderMesh.scale.set(-1, 1, 1);
scene.add(cylinderMesh);

// 1) Create a global raycaster and center-of-screen vector
const raycaster = new THREE.Raycaster();
const centerNDC = new THREE.Vector2(0, 0);  // x=0,y=0 is exactly the middle of the viewport

const canvas = document.getElementById("three-canvas");

window.addEventListener("deviceorientation", (event) => {
  //console.log("a b g", event.alpha.toFixed(0), event.beta.toFixed(0), event.gamma.toFixed(0));
  alpha = event.alpha || 0;  // roll around Z
  beta  = event.beta  || 0;  // pitch around X
  gamma = event.gamma || 0;  // yaw around Y
  
}, true);

window.addEventListener('devicemotion', (event) => {
    rotationSpeed = event.rotationRate.gamma * (Math.PI / 180);
    aRate = event.rotationRate.alpha || 0;  // roll around Z
    bRate  = event.rotationRate.beta  || 0;  // pitch around X
    gRate = event.rotationRate.gamma || 0;  // yaw around Y
    xAcc = event.accelerationIncludingGravity.x || 0;  // roll around Z
    yAcc  = event.accelerationIncludingGravity.y  || 0;  // pitch around X
    zAcc = event.accelerationIncludingGravity.z || 0;  // yaw around Y  
}, true);

window.addEventListener('keydown', e => {
  console.log("keypress", e.key.toLowerCase());
  //if (e.key.toLowerCase() !== 's') return;  Get keypress event, but not the remapped one 
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const hits = raycaster.intersectObject(cylinderMesh, false);
  if (!hits.length) return;

  const hit = hits[0];
  // offset the sprite slightly toward the camera to avoid z-fighting:
  const offset = hit.face.normal.clone().multiplyScalar(-0.02);
  const pos = hit.point.clone().add(offset);

  // create and place the indicator
  const indicator = createIndicatorSprite();
  indicator.position.copy(pos);
  scene.add(indicator);

  // remove it after 1s
  setTimeout(() => {
    scene.remove(indicator);
    indicator.material.dispose();
    indicator.geometry.dispose();
  }, 1000);

  // pass along your UV coords as before
  onTexturePointSelected(hit.uv.x, hit.uv.y);
});

function makeCircleTexture(size = 64, color = 'red') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.beginPath();
  ctx.arc(size/2, size/2, size*0.4, 0, Math.PI*2);
  ctx.fillStyle = color;
  ctx.fill();
  return new THREE.CanvasTexture(canvas);
}
const circleTexture = makeCircleTexture();

// 2) A factory for your indicator sprite
function createIndicatorSprite() {
  const mat = new THREE.SpriteMaterial({
    map: circleTexture,
    depthTest: false,   // always on top of the cylinder wall
    depthWrite: false,  // so it doesn’t occlude itself
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2, 2, 10); // size in world units; tweak as needed
  return sprite;
}

function onTexturePointSelected(u, v) {
  console.log("Texture coords:", (u * 2800).toFixed(0), ((1 - v) * 1400).toFixed(0));
}

function degToRad(deg) {
  return deg * Math.PI / 180;
}


const cameraEuler = new THREE.Euler(0, 0, 0, 'XYZ');
const cameraQuat = new THREE.Quaternion();
const rollQuat = new THREE.Quaternion();

const clock = new THREE.Clock();

// Camera translation
const maxSpeed = 25; // units per second (adjust as desired)
const range = 20 // translation will be within +-range degrees of y axis
const gRange = 8.2 


function animate(time) {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta(); // time in seconds since last frame
    
  const alphaRad = degToRad(alpha);
  const betaRad  = degToRad(beta);
  const gammaRad = degToRad(gamma);
  
  //console.log("a b g: ", alpha.toFixed(0), beta.toFixed(0), gamma.toFixed(0))
  //console.log("a b g: ", aRate.toFixed(1), bRate.toFixed(1), gRate.toFixed(1))
  //.log("x y z: ", xAcc.toFixed(2), yAcc.toFixed(2), zAcc.toFixed(2))


  // 1) Camera orientation (pitch + yaw only)
  cameraEuler.set(betaRad, gammaRad, 0, 'XYZ');
  cameraQuat.setFromEuler(cameraEuler);
  camera.quaternion.copy(cameraQuat);
  
  currentRotation += rotationSpeed * delta;
  if(isNaN(currentRotation)) currentRotation = 0.;
  
  // 2) Camera movement
  let accel = 0.;
  if (zAcc < -1 * gRange) {
    accel = (gRange + zAcc) / (gRange - 9.4);
  } 
  if (zAcc > gRange ) {
    accel = (gRange - zAcc) / (9.4 - gRange);
  }
  //console.log("accel", zAcc.toFixed(1), accel.toFixed(1));

  if (accel < -1.5) accel = -1.5;
  if (accel > 1.5) accel = 1.5;
  const speed = accel * maxSpeed;
  camera.position.z += speed * delta;
  if (accel != 0) currentRotation = 0;

  //const b = Math.abs(beta);
  //let accel = 0.;
  //if (b < range) {
  //  accel = (range - b)/range; // 0 - 1
  //  const speed = accel * maxSpeed;
   // camera.position.z -= speed * delta; // move down
  //} 
  //if (b > 180 - range) {
  //  accel = (range - (180 - b))/range; // 0 - 1
  //  const speed = accel * maxSpeed;
  //  camera.position.z += speed * delta; // move up
  //}
  camera.position.z = THREE.MathUtils.clamp(camera.position.z, -50, 50);

  // 3) Keep cylinder upright by applying negative roll about Z
  rollQuat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -alphaRad);
  cylinderMesh.quaternion.copy(rollQuat);
  
  // 4) Magnification by roll
  const t = Math.abs(currentRotation)/2; // 0-2 /2     
  const baseFov = 100;
  const minFov = 20;
  camera.fov = THREE.MathUtils.lerp(baseFov, minFov, t);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);
}

animate();


