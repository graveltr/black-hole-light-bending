import * as THREE from 'three';
import { parseCSV } from './utilities.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// Grab environment variables which I use as CLI arguments / switches.
const CAPTUREON = import.meta.env.VITE_CAPTUREON;
const CAPTURESECONDS = import.meta.env.VITE_CAPTURESECONDS;
const MAXPOINTS = import.meta.env.VITE_MAXPOINTS;

process();


/*
* This is the main body of code. It is called once all of the fetch requests
* above complete. It is passed a camera trajectory and an array of light ray 
* trajectories, which themselves are arrays of vectors (x,y,z coordinates).
*/
function process() {
  console.log("hello world");

  // Set up the THREE.js scene.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  const cameraCenter = new THREE.Vector3(0, 0, 0);
  const renderer = new THREE.WebGLRenderer();

  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  camera.up.set(0, 0, 1);
  camera.position.set(2.0,2.0,0.0); 
  camera.lookAt(cameraCenter);

  const geometry = new THREE.BoxGeometry(0.25, 0.25, 0.25);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: false });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(0,0,0);
  scene.add(cube);

  let animationId;
  let frame = 0;
  let radialGrowthVelocity = 0.00;

  let sphericalCoords = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z);
  let alpha = sphericalCoords.phi - Math.PI / 2.0;
  let beta = alpha + Math.PI;
  console.log(alpha);
  
  let currPhiLength = Math.PI;
  let contractionVelocity = 0.001;

  let leftHemisphere = createSphereMeshTwo(1.0, Math.PI / 4.0, 3.0 * Math.PI / 4.0, alpha - currPhiLength / 2.0, alpha + currPhiLength / 2.0);
  //let rightHemisphere = createSphereMeshTwo(1.0, beta - currPhiLength / 2.0, beta + currPhiLength / 2.0);
  scene.add(leftHemisphere);
  //scene.add(rightHemisphere);

  function animate() {
    animationId = requestAnimationFrame( animate );

    /*
    currPhiLength -= contractionVelocity;

    let leftHemisphereStartPhi = alpha - (currPhiLength / 2.0);
    let leftHemisphereEndPhi = alpha + (currPhiLength / 2.0);

    let rightHemisphereStartPhi = beta + (currPhiLength / 2.0);
    let rightHemisphereEndPhi = beta - (currPhiLength / 2.0);

    scene.remove(leftHemisphere);
    scene.remove(rightHemisphere);
    leftHemisphere = createSphereMeshTwo(1.0, leftHemisphereStartPhi, leftHemisphereEndPhi);
    rightHemisphere = createSphereMeshTwo(1.0, rightHemisphereStartPhi, rightHemisphereEndPhi);
    scene.add(leftHemisphere);
    scene.add(rightHemisphere);
    */

    frame += 1;
	  renderer.render( scene, camera );
  }

  animate();
}

function createSphereMesh(radius, phiLength, rotation) {
  const sphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 
      15, 
      15,
      0.0,
      phiLength,
      0, 
      Math.PI), 
    new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      wireframe: true,
      side: THREE.DoubleSide
    })
  );

  // sphereMesh.rotation.x = Math.PI / 2.0;
  //sphereMesh.position.set(0, 0, 0); // Position at the origin

  return sphereMesh;
}

function createSphereMeshTwo(radius, startTheta, endTheta, startPhi, endPhi) {
  const phiLength = endPhi - startPhi;
  const thetaLength = endTheta - startTheta;
    
  // Ensure the azimuth values are within the range [0, 2 * Math.PI]
  startPhi = (startPhi + 2 * Math.PI) % (2 * Math.PI);
  endPhi = (endPhi + 2 * Math.PI) % (2 * Math.PI);

  const geometry = new THREE.SphereGeometry(
    radius, 
    15, 
    15,
    0.0,
    phiLength,
    startTheta, 
    thetaLength
  );

  //geometry.rotateX(Math.PI / 2.0);

  const material =  new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      wireframe: true,
      side: THREE.DoubleSide
  })

  const sphereMesh = new THREE.Mesh(geometry, material);

  sphereMesh.rotateZ(Math.PI); // Align the axis to the z-axis
  sphereMesh.updateMatrix;
  sphereMesh.rotateX(Math.PI / 2.0); // Align the axis to the z-axis
  sphereMesh.updateMatrix;
  sphereMesh.rotateY(startPhi); 

  return sphereMesh;
}

function cartesianToSpherical(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const theta = Math.acos(z / r);    // acos to get the polar angle
  const phi = Math.atan2(y, x);  // atan2 handles the quadrant correctly

  return { r, theta, phi };
}

function sphericalToCartesian(r, theta, phi) {
    let x = r * Math.sin(theta) * Math.cos(phi);
    let y = r * Math.sin(theta) * Math.sin(phi);
    let z = r * Math.cos(theta);

    return { x, y, z };
}