import * as THREE from 'three';
import { parseCSV } from './utilities.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// Grab environment variables which I use as CLI arguments / switches.
const CAPTUREON = import.meta.env.VITE_CAPTUREON;
const CAPTURESECONDS = import.meta.env.VITE_CAPTURESECONDS;
const MAXPOINTS = import.meta.env.VITE_MAXPOINTS;

const colors = [];
colors.push(0xffffff);
colors.push(0x3F84E5);
colors.push(0xBAFF29);

const sceneOneCsvUrls = [];
const sceneOneBasePath = "trajectories/photon-sphere-to-photon-shell/scene1/"
sceneOneCsvUrls.push(sceneOneBasePath + "cameraTrajectory.csv");
const numLaunchPoints = 10;
const numLaunchAngles = 4;
for (let i = 0; i < numLaunchPoints; ++i) {
  for (let j = 0; j < numLaunchAngles; ++j) {
    sceneOneCsvUrls.push(sceneOneBasePath + "ray-" + String(i + 1) + "-" + String(j + 1) + ".csv");
  }
}
console.log("hello world");
console.log(sceneOneCsvUrls);

// Map over the URLs and return an array of promises.
// Both fetch and response.text return promises, thus 
// fetchPromises results in an array of promises.
const fetchPromises = sceneOneCsvUrls.map(url =>
  fetch(url).then(response => response.text())
);

// Use Promise.all to wait for all fetch requests to complete.
Promise.all(fetchPromises)
  .then(csvTexts => {
    // csvTexts is an array containing the contents of each CSV file as text.
    const trajectories = csvTexts.map(csvText => parseCSV(csvText));
    loadPhotonShell(trajectories[0], trajectories.slice(1));
  })
  .catch(error => {
    console.error('Error fetching one or more CSV files:', error);
  });

function loadPhotonShell(cameraTrajectory, rayTrajectories) {
  // Load the keyframes for animating the photon shell.
  // Each keyframe is an object showing the cross-section of the photon shell 
  // at a given spin. Keyframes is an array containing these cross-sections
  // in increasing spin value as one increase the array index.
  loadPhotonShellKeyframes().then(keyframes => {
    console.log("All keyframes loaded", keyframes);
    process(cameraTrajectory, rayTrajectories, keyframes);
  }).catch(error => {
    console.error("An error occurred while loading keyframes:", error);
  });
}

/*
* This is the main body of code. It is called once all of the fetch requests
* above complete. It is passed a camera trajectory and an array of light ray 
* trajectories, which themselves are arrays of vectors (x,y,z coordinates).
*/
function process(cameraTrajectory, rayTrajectories, photonShellKeyframes) {
  console.log("hello world");

  // Set up the THREE.js scene.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  const cameraCenter = new THREE.Vector3(0, 0, 0);
  const renderer = new THREE.WebGLRenderer();
  const textureLoader = new THREE.TextureLoader();
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  // Add all of the scene elements.
  addBlackHole(scene);
  addSpinAxis(scene);
  addSkyDome(scene, textureLoader);

  const capturer = new CCapture({
    format: 'webm',
    framerate: 60
  });
  if (CAPTUREON == 1) { capturer.start(); }

  // UI References
  let animationId;
  camera.up.set(0, 0, 1);

  let currGlobalFrame = 0;
  let currClip = 0;
  let currClipFrame = 0;
  let numFramesPerClip = [50, -1, 50];

  let rayMeshes = [];
  let trails = [];

  camera.position.set(cameraTrajectory[0][0],cameraTrajectory[0][1],cameraTrajectory[0][2]); 
  camera.lookAt(cameraCenter);

  function animate() {
    animationId = requestAnimationFrame( animate );

    console.log(currClipFrame);

    // Initialize clips on frame one
    if (currClipFrame === 0) {
      if (currClip === 0) {
        rayMeshes = addRays(scene, rayTrajectories.length);
        trails = addTrails(scene, rayTrajectories.length, rayTrajectories.map(matrix => matrix[0]));
      } else if (currClip === 1) {
        trails.forEach((element) => {
          scene.remove(element);
        })
        rayMeshes.forEach((element) => {
          scene.remove(element);
        })
      } else if (currClip === 2) {

      } else {
        console.log("Clip counter is out of bounds");
      }
    }

    // Update clips
    if (currClip === 0) {
      for (let j = 0; j < rayMeshes.length; j++){
        rayMeshes[j].position.set(rayTrajectories[j][currClipFrame][0], rayTrajectories[j][currClipFrame][1], rayTrajectories[j][currClipFrame][2]);
        updateTrail(rayMeshes[j], trails[j]);
      }
      camera.position.set(cameraTrajectory[currClipFrame][0],cameraTrajectory[currClipFrame][1],cameraTrajectory[currClipFrame][2]); 
      camera.lookAt(cameraCenter);
    } else if (currClip === 1) {
      camera.position.set(camera.position.x, camera.position.y, camera.position.z - 0.25);
      camera.lookAt(cameraCenter);

      if (approximatelyEqual(camera.position.z, 0.0, 0.26)) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      }
    } else if (currClip === 2) {
      if (currClipFrame !== 0) {
        scene.remove(photonShellKeyframes[currClipFrame - 1]);
      }
      scene.add(photonShellKeyframes[currClipFrame]);
    } else {
      console.log("Clip counter is out of bounds");
    }

	  renderer.render( scene, camera );

    currClipFrame = currClipFrame + 1;
    if (currClipFrame === numFramesPerClip[currClip]) {
      currClip = (currClip + 1) % numFramesPerClip.length;
      currClipFrame = 0;
    }

    currGlobalFrame = currGlobalFrame + 1;

    if (CAPTUREON == 1) { 
      console.log('capturing!')
      capturer.capture( renderer.domElement ); 
    }
  }

  animate();

  if (CAPTUREON == 1) {
    setTimeout(() => {
      cancelAnimationFrame(animationId);
      capturer.stop();
      capturer.save();
    }, CAPTURESECONDS * 1000);
  }
}

/* 
* Function responsible for updating the trails of each light ray.
*/ 
function updateTrail(object, trail) {
  const trailGeometry = trail.geometry;

  /*
  * Obtain a reference to the the position data. Remember, it is a flat array of position data
  * for the trail nodes, x1,y1,z1,x2,y2,z2,...
  */
  const positionAttribute = trailGeometry.attributes.position;

  // Shift the positions back to make room for the new point.
  for (let i = positionAttribute.count - 1; i > 0; i--) {
    const prevIndex = (i - 1) * 3;
    const currentIndex = i * 3;
    positionAttribute.array[currentIndex] = positionAttribute.array[prevIndex];
    positionAttribute.array[currentIndex + 1] = positionAttribute.array[prevIndex + 1];
    positionAttribute.array[currentIndex + 2] = positionAttribute.array[prevIndex + 2];
  }

  // Add the object's current position as the new point at the front of the trail.
  positionAttribute.array[0] = object.position.x;
  positionAttribute.array[1] = object.position.y;
  positionAttribute.array[2] = object.position.z;

  // Notify Three.js that the positions need updating.
  positionAttribute.needsUpdate = true;

  trail.computeLineDistances();
}

function resetTrail(object, trail) {
  const trailGeometry = trail.geometry;
  const positionAttribute = trailGeometry.attributes.position;

  for (let i = 0; i < positionAttribute.count; i++) {
    const currentIndex = i * 3;
    positionAttribute.array[currentIndex] = object.position.x;
    positionAttribute.array[currentIndex + 1] = object.position.y;
    positionAttribute.array[currentIndex + 2] = object.position.z;
  }

  // Notify Three.js that the positions need updating.
  positionAttribute.needsUpdate = true;

  trail.computeLineDistances();

}

function addRays(scene, numRays) {
  const rayMeshes = [];

  for (let i = 0; i < numRays; i++){
    const rayMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    rayMeshes.push(rayMesh);
    scene.add(rayMesh);
  }

  return rayMeshes
}

function addTrails(scene, numRays, initialPositions) {
  let trails = [];

  // Iterate through the rays.
  for (let i = 0; i < numRays; i++) {
    // This is the THREE object that will encapsulate the trail.
    const trailGeometry = new THREE.BufferGeometry();

    /*
    * This is a flattened array that contains the position data of 
    * the nodes in the trail: x1,y1,z1,x2,y2,z2,... 
    * 
    * We initialize all trail nodes to start at the initial position
    * of the ray trajectory.
    */
    const positions = new Float32Array(MAXPOINTS * 3);

    for (let j = 0; j < positions.length; j += 3) {
      positions[j] = initialPositions[i][0];
      positions[j+1] = initialPositions[i][1];
      positions[j+2] = initialPositions[i][2];
    }

    trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    let trailMaterial; 
    trailMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.computeLineDistances();

    trails.push(trail);
    scene.add(trail);
  }

  return trails;
}

function addTrail(scene, initialPosition, color) {
  const trailGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MAXPOINTS * 3);

  for (let j = 0; j < positions.length; j += 3) {
    positions[j] = initialPosition[0];
    positions[j+1] = initialPosition[1];
    positions[j+2] = initialPosition[2];
  }
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const trailMaterial = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
  let trail = new THREE.Line(trailGeometry, trailMaterial);

  scene.add(trail);
  return trail;
}

function addSkyDome(scene, textureLoader) {
  const skyGeometry = new THREE.SphereGeometry(2000, 60, 40);
  const skyTexture = textureLoader.load('eso0932a.jpg'); 

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

function addEquatorialDisk(scene) {
  const radiusTop = 40;        // Radius at the top of the cylinder
  const radiusBottom = 40;     // Radius at the bottom of the cylinder
  const height = 0.01;        // Height of the cylinder (very small to make it a disk)
  const radialSegments = 100;  // Number of segmented faces around the circumference of the disk
  const heightSegments = 1;   // Number of segmented faces along the height of the cylinder
  const openEnded = false;    // Whether the ends are open or capped

  const diskGeometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded);
  const diskMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x808080, 
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide 
  });
  const diskMesh = new THREE.Mesh(diskGeometry, diskMaterial);

  diskMesh.rotation.x = Math.PI / 2;

  scene.add(diskMesh);
}

function addRedRing(scene) {
  const epsilon = 1.0;
  const rcrit = 21.92;
  const radius = rcrit + epsilon;
  const curve = new THREE.EllipseCurve(
    0,  0,            // ax, aY
    radius, radius,   // xRadius, yRadius
    0,  2 * Math.PI,  // aStartAngle, aEndAngle
    false,            // aClockwise
    0                 // aRotation
  );

  const points = curve.getPoints(1000);
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color: 0xFF3c38,
    linewidth: 3.0,
    transparent: true,
    opacity: 1.0,
  });
  const line = new THREE.Line(geometry, material);

  scene.add(line);

  return material; 
}

function addConcentricCircles(scene) {
  const N = 20;
  const radiusBase = 10;
  const radiusSpacing = 2;

  for (let i = 0; i < N; i++) {
    const radius = radiusBase + i * radiusSpacing;

    const curve = new THREE.EllipseCurve(
      0,  0,            // ax, aY
      radius, radius,           // xRadius, yRadius
      0,  2 * Math.PI,  // aStartAngle, aEndAngle
      false,            // aClockwise
      0                 // aRotation
    );

    const points = curve.getPoints(100); // 50 points for smoothness
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    const line = new THREE.Line(geometry, material);

    scene.add(line);
  }
}

function addFullyTracedRay(scene, fullyTracedTrajectory) {
  const positions = fullyTracedTrajectory.flat();

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.LineBasicMaterial({ 
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
  });
  const line = new THREE.Line(geometry, material);

  scene.add(line);
}

function addBlackHole(scene) {
  const blackholeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(20, 64, 64), 
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

function cartesianToSpherical(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const theta = Math.acos(z / r);    // acos to get the polar angle
  const phi = Math.atan2(y, x);  // atan2 handles the quadrant correctly

  return { r, theta, phi };
}

function radiansToDegrees(theta) {
  return theta * (180.0 / Math.PI);
}

// Helper function to pad a number to align by decimal point
function formatNumber(num, precision = 2) {
  let [intPart, decPart] = num.toFixed(precision).split('.');
  intPart = intPart.padStart(3, ' '); // Adjust based on maximum expected length
  return `${intPart}.${decPart}`;
}

function getEquatorialCrossingIndices(rayTrajectories) {
  let equatorialCrossingIndices = [];
  equatorialCrossingIndices.push(rayTrajectories[0].length);

  for (let i = 1; i < rayTrajectories.length; ++i) {
    equatorialCrossingIndices.push(equatorialCrossingIndices[i - 1] + rayTrajectories[i].length);
  }

  return equatorialCrossingIndices;
}

function padTrajectory(rayTrajectory, trajectoryIndex, lengths) {
  let numPadElementsBefore = 0;
  for (let i = 0; i < trajectoryIndex; ++i) {
    numPadElementsBefore = numPadElementsBefore + lengths[i];
  }

  let numPadElementsAfter = 0;
  for (let i = trajectoryIndex + 1; i < lengths.length; ++i) {
    numPadElementsAfter = numPadElementsAfter + lengths[i];
  }

  let startPosition = rayTrajectory[0];
  let endPosition = rayTrajectory[rayTrajectory.length - 1];
  console.log(startPosition)
  console.log(endPosition)


  const paddingBefore = Array(numPadElementsBefore).fill(startPosition);
  const paddingAfter = Array(numPadElementsAfter).fill(endPosition);

  return paddingBefore.concat(rayTrajectory).concat(paddingAfter);
}

function addEquatorialRings(scene) {
  const rcrits = [28.0, 32.0, 36.0];
  let materials = [];

  for (let i = 0; i < rcrits.length; ++i) {
    const radius = rcrits[i];
    const curve = new THREE.EllipseCurve(
      0,  0,            // ax, aY
      radius, radius,   // xRadius, yRadius
      0,  2 * Math.PI,  // aStartAngle, aEndAngle
      false,            // aClockwise
      0                 // aRotation
    );

    const points = curve.getPoints(1000);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ 
      color: colors[i],
      linewidth: 3.0,
      transparent: true,
      opacity: 1.0,
    });
    const line = new THREE.Line(geometry, material);

    scene.add(line);
    materials.push(material);
  }

  return materials; 
}

/*
*  Returns a promise that resolves with the keyframes array once all keyframes
*  are loaded.
*/
function loadPhotonShellKeyframes() {
  const objLoader = new OBJLoader();
  const lastFrame = 80;
  const keyframes = [];
  const basePath = "models/photonShellAnimation/";
  
  const loadKeyframe = (path) => {
    return new Promise((resolve, reject) => {
      objLoader.load(
        path,
        object => resolve(object),
        undefined,
        error => reject(error)
      );
    });
  };

  const loadAllKeyframes = async () => {
    for (let i = 1; i <= lastFrame; i++) {
      const currKeyframePath = `${basePath}photon-shell-keyframe-${i}.obj`;
      console.log("loading: " + currKeyframePath);

      try {
        const object = await loadKeyframe(currKeyframePath);
        console.log("successfully loaded " + currKeyframePath);
        keyframes.push(object);
      } catch (error) {
        console.error("Error loading " + currKeyframePath, error);
      }
    }

    return keyframes;
  };

  return loadAllKeyframes();
}

function approximatelyEqual(a, b, epsilon) {
    return Math.abs(a - b) <= epsilon;
}