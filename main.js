import * as THREE from 'three';
import { parseCSV } from './utilities.js';

console.log("hello world")

const CAPTUREON = import.meta.env.VITE_CAPTUREON;
const CAPTURESECONDS = import.meta.env.VITE_CAPTURESECONDS;
const MOVIENUMBER = import.meta.env.VITE_MOVIENUMBER;
const MAXPOINTS = import.meta.env.VITE_MAXPOINTS;

const colors = [];
if (MOVIENUMBER == 1) {
  colors.push(0xff0000);
  colors.push(0x00ff00);
  colors.push(0x48B8D0);
} else if (MOVIENUMBER == 2) {
  colors.push(0xff0000);
  colors.push(0xff0000);
  colors.push(0x00ff00);
  colors.push(0x00ff00);
  colors.push(0x48B8D0);
  colors.push(0x48B8D0);
} else if (MOVIENUMBER == 3) {
  colors.push(0x32CD32);
  colors.push(0x17BEBB);
} else {
  throw new Error('Unknown movie number!');
}

const csvUrls = [];
if (MOVIENUMBER == 1) {
  csvUrls.push('trajectories/subsupercritical/cameraTrajectory.csv');
  csvUrls.push('trajectories/subsupercritical/ray1.csv');
  csvUrls.push('trajectories/subsupercritical/ray2.csv');
  csvUrls.push('trajectories/subsupercritical/ray3.csv');
} else if (MOVIENUMBER == 2) {
  csvUrls.push('trajectories/pairwise/cameraTrajectory.csv');
  csvUrls.push('trajectories/pairwise/ray1.csv');
  csvUrls.push('trajectories/pairwise/ray2.csv');
  csvUrls.push('trajectories/pairwise/ray3.csv');
  csvUrls.push('trajectories/pairwise/ray4.csv');
  csvUrls.push('trajectories/pairwise/ray5.csv');
  csvUrls.push('trajectories/pairwise/ray6.csv');
} else if (MOVIENUMBER == 3) {
  csvUrls.push('trajectories/equatorial-rays/cameraTrajectory.csv');
  csvUrls.push('trajectories/equatorial-rays/ray1.csv');
  csvUrls.push('trajectories/equatorial-rays/ray2.csv');
} else {
  throw new Error('Unknown movie number!');
}

// Map over the URLs and return an array of promises
const fetchPromises = csvUrls.map(url =>
  fetch(url).then(response => response.text())
);

// Use Promise.all to wait for all fetch requests to complete
Promise.all(fetchPromises)
  .then(csvTexts => {
    // csvTexts is an array containing the contents of each CSV file as text
    const trajectories = csvTexts.map(csvText => parseCSV(csvText));
    process(trajectories[0], trajectories.slice(1));
  })
  .catch(error => {
    console.error('Error fetching one or more CSV files:', error);
  });

function process(cameraTrajectory, rayTrajectories) {

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  const cameraCenter = new THREE.Vector3(0, 0, 0);
  const renderer = new THREE.WebGLRenderer();
  const textureLoader = new THREE.TextureLoader();
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  // Add all of the scene elements
  addBlackHole(scene);
  addSpinAxis(scene);
  addSkyDome(scene, textureLoader);
  const rayMeshes = addRays(scene, rayTrajectories.length);
  const [trails, currPoints] = addTrails(scene, rayTrajectories.length, rayTrajectories.map(matrix => matrix[0]));
  if(MOVIENUMBER == 2) { addRadialAxis(scene); }

  const capturer = new CCapture({
    format: 'webm',
    framerate: 60
  });
  if(CAPTUREON == 1) { capturer.start(); }

  let i = 0;
  let animationId;
  camera.up.set(0, 0, 1);
  function animate() {
	  animationId = requestAnimationFrame( animate );

    camera.position.set(cameraTrajectory[i][0],cameraTrajectory[i][1],cameraTrajectory[i][2]); // Positioned 10 units above the x-y plane
    camera.lookAt(cameraCenter);

    for (let j = 0; j < rayMeshes.length; j++){
	    rayMeshes[j].position.set(rayTrajectories[j][i][0], rayTrajectories[j][i][1], rayTrajectories[j][i][2])
      updateTrail(rayMeshes[j], trails[j], currPoints, j)
    }
	  i += 1
	  renderer.render( scene, camera );

    if(CAPTUREON == 1) { 
      console.log('capturing!')
      capturer.capture( renderer.domElement ); 
    }
  }

  animate();

  if(CAPTUREON == 1) {
    setTimeout(() => {
      cancelAnimationFrame(animationId);
      capturer.stop();
      capturer.save();
    }, CAPTURESECONDS * 1000);
  }
}

function addRays(scene, numRays) {
  const rayMeshes = [];
  for (let i = 0; i < numRays; i++){
    const rayMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 32, 32),
      new THREE.MeshBasicMaterial({ color: colors[i] })
    );
    rayMeshes.push(rayMesh);
    scene.add(rayMesh);
  }

  return rayMeshes
}

function addTrails(scene, numRays, initialPositions) {
  let trails = [];
  let currPoints = [];
  for (let i = 0; i < numRays; i++) {
    const trailGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(MAXPOINTS * 3);
    for (let j = 0; j < positions.length; j += 3) {
      positions[j] = initialPositions[i][0];
      positions[j+1] = initialPositions[i][1];
      positions[j+2] = initialPositions[i][2];
    }
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const trailMaterial = new THREE.LineBasicMaterial({ color: colors[i], linewidth: 3 });
    const trail = new THREE.Line(trailGeometry, trailMaterial)
    currPoints.push(0);
    trails.push(trail);
    scene.add(trail);
  }

  return [trails, currPoints];
}

function addSkyDome(scene, textureLoader) {
  const skyGeometry = new THREE.SphereGeometry(2000, 60, 40);
  const skyTexture = textureLoader.load('eso0932a.jpg'); // Replace with the path to your sky texture
  skyTexture.colorSpace = THREE.SRGBColorSpace;
  const skyMaterial = new THREE.MeshBasicMaterial({
    map: skyTexture,
    side: THREE.BackSide
  });
  const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
  skyDome.position.set(0,0,0);
  skyDome.rotateX(Math.PI/2.0)
  scene.add(skyDome);
}

function addBlackHole(scene) {
  const blackholeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(10.4, 64, 64), 
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  scene.add(blackholeMesh);
}

function addRadialAxis(scene) {
  const radialAxisPoints = [];
  radialAxisPoints.push(new THREE.Vector3(0, 0, 0));
  radialAxisPoints.push(new THREE.Vector3(40, 0, 0));
  const radialAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(radialAxisPoints), 
    new THREE.LineBasicMaterial({ color: 0xe1e1e1, linewidth: 2 })
  );
  scene.add(radialAxis)
}

function addSpinAxis(scene) {
  const axisPoints = [];
  axisPoints.push(new THREE.Vector3(0, 0, 15));
  axisPoints.push(new THREE.Vector3(0, 0, -15));
  const spinAxis = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(axisPoints), 
    new THREE.LineBasicMaterial({ color: 0xe1e1e1, linewidth: 3 })
  );
  scene.add(spinAxis)
}

function updateTrail(object, trail, points, idx) {
  const trailGeometry = trail.geometry;
  const positionAttribute = trailGeometry.attributes.position;

  // Shift the positions back to make room for the new point
  for (let i = positionAttribute.count - 1; i > 0; i--) {
    const prevIndex = (i - 1) * 3;
    const currentIndex = i * 3;
    positionAttribute.array[currentIndex] = positionAttribute.array[prevIndex];
    positionAttribute.array[currentIndex + 1] = positionAttribute.array[prevIndex + 1];
    positionAttribute.array[currentIndex + 2] = positionAttribute.array[prevIndex + 2];
  }

  // Add the object's current position as the new point at the front of the trail
  positionAttribute.array[0] = object.position.x;
  positionAttribute.array[1] = object.position.y;
  positionAttribute.array[2] = object.position.z;

  // Notify Three.js that the positions need updating
  positionAttribute.needsUpdate = true;
}


/*const particlesGeometry = new THREE.BufferGeometry();
const starsVertices = [];
for (let i = 0; i < 50000; i++) {
  const r = getRandomFloatOutsideInterval(200, 500);
  const theta = Math.random() * Math.PI;
  const phi = Math.random() * 2 * Math.PI;
  const cartesianCoords = sphericalToCartesian(r, theta, phi)
  starsVertices.push(cartesianCoords.x, cartesianCoords.y, cartesianCoords.z);
}
particlesGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
const particlesMaterial = new THREE.PointsMaterial({ color: 0xffffff });
const starField = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(starField); */
