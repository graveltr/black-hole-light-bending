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
const numLaunchAngles = 2;
for (let i = 0; i < numLaunchPoints; ++i) {
  for (let j = 0; j < numLaunchAngles; ++j) {
    sceneOneCsvUrls.push(sceneOneBasePath + "ray-" + String(i + 1) + "-" + String(j + 1) + ".csv");
  }
}
console.log("hello world");
console.log(sceneOneCsvUrls);

const basepaths = [];
basepaths.push("trajectories/photon-sphere-to-photon-shell/inner-photon-shell-cross-section-trajectories/");
basepaths.push("trajectories/photon-sphere-to-photon-shell/middle-photon-shell-cross-section-trajectories/");
basepaths.push("trajectories/photon-sphere-to-photon-shell/outer-photon-shell-cross-section-trajectories/");
const numCrossSections = basepaths.length;

let numAzimuths = 10;
const photonShellCrossSectionTrajectoriesCsvUrls = [];
for (let i = 0; i < numCrossSections; ++i) {
  for (let j = 1; j <= numAzimuths; ++j) {
    photonShellCrossSectionTrajectoriesCsvUrls.push(basepaths[i] + "ray-" + String(j) + ".csv");
  }
}

console.log(photonShellCrossSectionTrajectoriesCsvUrls);

let numSceneOneTrajectories = sceneOneCsvUrls.length - 1; // Minus 1 because of camera trajectory

// Map over the URLs and return an array of promises.
// Both fetch and response.text return promises, thus 
// fetchPromises results in an array of promises.
const sceneOnePromises = sceneOneCsvUrls.map(url =>
  fetch(url).then(response => response.text())
);

const photonShellCrossSectionTrajectoriesPromises = photonShellCrossSectionTrajectoriesCsvUrls.map(url =>
  fetch(url).then(response => response.text())
);

const fetchPromises = sceneOnePromises.concat(photonShellCrossSectionTrajectoriesPromises);

// Use Promise.all to wait for all fetch requests to complete.
Promise.all(fetchPromises)
  .then(csvTexts => {
    // csvTexts is an array containing the contents of each CSV file as text.
    const trajectories = csvTexts.map(csvText => parseCSV(csvText));
    loadSpinValues(trajectories[0], trajectories.slice(1));
  })
  .catch(error => {
    console.error('Error fetching one or more CSV files:', error);
  });

function loadSpinValues(cameraTrajectory, rayTrajectories) {
  console.log("loading spin values");
  const spinValuesCsvUrl = "models/photonShellAnimation/spinValues.csv";
  fetch(spinValuesCsvUrl).then(response => response.text()).then(csvText => {
    console.log("spin values:");
    const spinValues = parseCSV(csvText);
    console.log(spinValues);
    loadPhotonShell(cameraTrajectory, rayTrajectories, spinValues);
  })
}

function loadPhotonShell(cameraTrajectory, rayTrajectories, spinValues) {
  // Load the keyframes for animating the photon shell.
  // Each keyframe is an object showing the cross-section of the photon shell 
  // at a given spin. Keyframes is an array containing these cross-sections
  // in increasing spin value as one increase the array index.
  loadPhotonShellKeyframes().then(keyframes => {
    console.log("All keyframes loaded", keyframes);
    loadPhotonShellSpin50(cameraTrajectory, rayTrajectories, keyframes, spinValues);
  }).catch(error => {
    console.error("An error occurred while loading keyframes:", error);
  });
}

function loadPhotonShellSpin50(cameraTrajectory, rayTrajectories, photonShellKeyframes, spinValues) {
  loadPhotonShellCrossSectionsSpin50().then(photonShellCrossSectionsSpin50 => {
    console.log("All photon shell cross sections at spin 50 loaded");
    process(cameraTrajectory, rayTrajectories, photonShellKeyframes, spinValues, photonShellCrossSectionsSpin50);
  }).catch(error => {
    console.error("An error occurred while loading keyframes:", error);
  });
}

/*
* This is the main body of code. It is called once all of the fetch requests
* above complete. It is passed a camera trajectory and an array of light ray 
* trajectories, which themselves are arrays of vectors (x,y,z coordinates).
*/
function process(cameraTrajectory, rayTrajectories, photonShellKeyframes, spinValues, photonShellCrossSectionsSpin50) {
  console.log("hello world");

  const sceneOneRayTrajectories = rayTrajectories.slice(0, numSceneOneTrajectories);
  const innerPhotonShellCrossSectionTrajectories = rayTrajectories.slice(numSceneOneTrajectories, numSceneOneTrajectories + numAzimuths);
  const middlePhotonShellCrossSectionTrajectories = rayTrajectories.slice(numSceneOneTrajectories + numAzimuths, numSceneOneTrajectories + 2 * numAzimuths);
  const outerPhotonShellCrossSectionTrajectories = rayTrajectories.slice(numSceneOneTrajectories + 2 * numAzimuths, rayTrajectories.length);
  
  const photonShellCrossSectionTrajectories = [];
  photonShellCrossSectionTrajectories.push(innerPhotonShellCrossSectionTrajectories);
  photonShellCrossSectionTrajectories.push(middlePhotonShellCrossSectionTrajectories);
  photonShellCrossSectionTrajectories.push(outerPhotonShellCrossSectionTrajectories);

  // Set up the THREE.js scene.
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
  const cameraCenter = new THREE.Vector3(0, 0, 0);
  const renderer = new THREE.WebGLRenderer();
  const textureLoader = new THREE.TextureLoader();
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );

  // Add all of the scene elements.
  let blackHole = addBlackHole(scene, 20.0);
  addSpinAxis(scene);
  addSkyDome(scene, textureLoader);

  const capturer = new CCapture({
    format: 'webm',
    framerate: 60
  });
  if (CAPTUREON == 1) { capturer.start(); }

  // UI References
  const spinReadout  = document.getElementById('spinReadout');

  let animationId;
  camera.up.set(0, 0, 1);

  let currGlobalFrame = 0;
  let currClip = 0;
  let currClipFrame = 0;
  let numFramesPerClip = new Array(11).fill(0);

  // Clip 0: Schwarzschild trajectories 
  numFramesPerClip[0] = -1;

  // Clip 1: Pulsing photon sphere 
  numFramesPerClip[1] = 100;

  // Clip 2: Camera into the equatorial plane and contraction of photon sphere into cross section
  numFramesPerClip[2] = -1;

  // Clip 3: Expansion of the photon sphere into photon shell at 50% spin
  numFramesPerClip[3] = 230;

  // Clip 4: Bring camera back up into orbit
  numFramesPerClip[4] = -1;

  // Clip 5: First photon shell cross section trajectories
  numFramesPerClip[5] = 400;

  const crossSectionPulseTime = 200;

  // Clip 6: Pulse the first photon shell cross section
  numFramesPerClip[6] = crossSectionPulseTime;

  // Clip 7: Add second photon shell cross section trajectories
  numFramesPerClip[7] = 400;

  // Clip 8: Pulse the second photon shell cross section
  numFramesPerClip[8] = crossSectionPulseTime;

  // Clip 9: Add third photon shell cross section trajectories
  numFramesPerClip[9] = 400;

  // Clip 10: Pulse the third photon shell cross section
  numFramesPerClip[10] = crossSectionPulseTime + 1000;

  let sceneOneRayMeshes = [];
  let sceneOneTrails = [];

  camera.position.set(cameraTrajectory[0][0],cameraTrajectory[0][1],cameraTrajectory[0][2]); 
  camera.lookAt(cameraCenter);

  const pulseAngularVelocity = 10.0;
  const pulsePhase = 0.25 * pulseAngularVelocity; // Shift in seconds
  const numPulses = 3.0;
  
  let clipStartTime;
  let photonSphereMesh;
  let currPhiLength = Math.PI;
  let contractionVelocity = 0.025;

  let leftHemisphere, rightHemisphere;

  let clipFrameOfHalfSpin;
  let currPhotonShellKeyframe = 0;

  let rcrits = [24.07, 27.62, 31.17];
  let thetaMinuses = [1.05, 0.20, 0.38];
  let thetaPluses = [2.09, 2.94, 2.76];

  let photonShellCrossSectionAngularOffset;

  // Each array element is a 2 dimensional array containing left and right line meshes for a given cross section
  let photonShellCrossSectionLineMeshes = [];

  // Each array element is a spherical mesh for a given cross section
  let photonShellCrossSectionSphericalMeshes = [];

  // Each array element is an array containing the trajectory meshes for a given cross section
  let photonShellCrossSectionRayMeshes = [];

  // Each array element is an array containing the trail meshes for a given cross section
  let photonShellCrossSectionTrails = [];

  // The counters that keep track of current trajectory iteration for each cross section
  let photonShellCrossSectionTrajectoryIdxs = [0, 0, 0];

  function animate() {
    animationId = requestAnimationFrame( animate );

    console.log(currClipFrame);

    // Initialize clips on frame one
    if (currClipFrame === 0) {
      if (currClip === 0) {
        console.log("starting clip 0")
        sceneOneRayMeshes = addRays(scene, sceneOneRayTrajectories.length);
        sceneOneTrails = addTrails(scene, sceneOneRayTrajectories.length, sceneOneRayTrajectories.map(matrix => matrix[0]));
      } else if (currClip === 1) {
        clipStartTime = performance.now() * 0.001;
        photonSphereMesh = createSphereMesh(30, 0.0, Math.PI, 0.0, 2.0 * Math.PI);
        scene.add(photonSphereMesh);
      } else if (currClip === 2) {
        scene.remove(photonSphereMesh);

        sceneOneTrails.forEach((element) => {
          scene.remove(element);
        })
        sceneOneRayMeshes.forEach((element) => {
          scene.remove(element);
        })

        let currPhi = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z).phi;
        let alpha = currPhi - Math.PI / 2.0;
        let beta = alpha + Math.PI;

        leftHemisphere = createSphereMesh(30.0, 0.0, Math.PI, alpha - currPhiLength / 2.0, alpha + currPhiLength / 2.0);
        rightHemisphere = createSphereMesh(30.0, 0.0, Math.PI, beta - currPhiLength / 2.0, beta + currPhiLength / 2.0);

        scene.add(leftHemisphere);
        scene.add(rightHemisphere);
      } else if (currClip === 3) {
        scene.remove(leftHemisphere);
        scene.remove(rightHemisphere);

        rotatePhotonShellKeyframes(camera.position, photonShellKeyframes);
        console.log("camera phi: " + cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z).phi);
        photonShellCrossSectionAngularOffset = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z).phi + Math.PI / 2.0;
        scene.add(photonShellKeyframes[0]);
        currPhotonShellKeyframe += 1;
      } else if (currClip === 4) {
      } else if (currClip === 6 || currClip === 8 || currClip === 10) { 
        clipStartTime = performance.now() * 0.001;

        let crossSectionIdx = (currClip === 6) ? 0 : (currClip === 8) ? 1 : 2;

        let lineMeshArr = [];
        lineMeshArr.push(createPhotonSphereLineMesh(rcrits[crossSectionIdx], thetaMinuses[crossSectionIdx], thetaPluses[crossSectionIdx], photonShellCrossSectionAngularOffset));
        lineMeshArr.push(createPhotonSphereLineMesh(rcrits[crossSectionIdx], thetaMinuses[crossSectionIdx], thetaPluses[crossSectionIdx], photonShellCrossSectionAngularOffset + Math.PI));
        lineMeshArr.forEach(lineMesh => {
          lineMesh.material.color.r = (currClip === 6) ? 1.0 : (currClip === 8) ? 0.0 : 0.0;
          lineMesh.material.color.g = (currClip === 6) ? 0.0 : (currClip === 8) ? 1.0 : 0.0;
          lineMesh.material.color.b = (currClip === 6) ? 0.0 : (currClip === 8) ? 0.0 : 1.0;
          scene.add(lineMesh);
        })
        photonShellCrossSectionLineMeshes.push(lineMeshArr);

        let currSphericalMesh = createSphereMesh(rcrits[crossSectionIdx], thetaMinuses[crossSectionIdx], thetaPluses[crossSectionIdx], 0.0, 2.0 * Math.PI);
        currSphericalMesh.material.color.r = (currClip === 6) ? 1.0 : (currClip === 8) ? 0.0 : 0.0;
        currSphericalMesh.material.color.g = (currClip === 6) ? 0.0 : (currClip === 8) ? 1.0 : 0.0;
        currSphericalMesh.material.color.b = (currClip === 6) ? 0.0 : (currClip === 8) ? 0.0 : 1.0;
        scene.add(currSphericalMesh);
        photonShellCrossSectionSphericalMeshes.push(currSphericalMesh);
      } else if (currClip === 5 || currClip === 7 || currClip === 9) {
        clipStartTime = performance.now() * 0.001;

        let crossSectionIdx = (currClip === 5) ? 0 : (currClip === 7) ? 1 : 2;

        let currRayMeshes = addRays(scene, innerPhotonShellCrossSectionTrajectories.length);
        currRayMeshes.forEach(mesh => {
          mesh.material.color.r = (currClip === 5) ? 1.0 : (currClip === 7) ? 0.0 : 0.0;
          mesh.material.color.g = (currClip === 5) ? 0.0 : (currClip === 7) ? 1.0 : 0.0;
          mesh.material.color.b = (currClip === 5) ? 0.0 : (currClip === 7) ? 0.0 : 1.0;
        })
        photonShellCrossSectionRayMeshes.push(currRayMeshes);

        let currTrails = addTrails(scene, photonShellCrossSectionTrajectories[crossSectionIdx].length, photonShellCrossSectionTrajectories[crossSectionIdx].map(matrix => matrix[0]));
        currTrails.forEach(trail => {
          trail.material.color.r = (currClip === 5) ? 1.0 : (currClip === 7) ? 0.0 : 0.0;
          trail.material.color.g = (currClip === 5) ? 0.0 : (currClip === 7) ? 1.0 : 0.0;
          trail.material.color.b = (currClip === 5) ? 0.0 : (currClip === 7) ? 0.0 : 1.0;
        })
        photonShellCrossSectionTrails.push(currTrails);
      } else if (currClip === 11) {
        clipStartTime = performance.now() * 0.001;
      } else {
        console.log("Clip counter is out of bounds");
      }
    }

    // Update clips
    if (currClip === 0) {
      let sphericalCoords = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z);
      let newPhi = sphericalCoords.phi + Math.PI / 600.0;
      let newCartesianCoords = sphericalToCartesian(sphericalCoords.r, sphericalCoords.theta, newPhi);
      camera.position.set(newCartesianCoords.x, newCartesianCoords.y, newCartesianCoords.z);
      camera.lookAt(cameraCenter);

      for (let j = 0; j < sceneOneRayMeshes.length; j++){
        sceneOneRayMeshes[j].position.set(sceneOneRayTrajectories[j][currClipFrame][0], sceneOneRayTrajectories[j][currClipFrame][1], sceneOneRayTrajectories[j][currClipFrame][2]);
        updateTrail(sceneOneRayMeshes[j], sceneOneTrails[j]);
      }

      currClipFrame = currClipFrame + 5;
      if (currClipFrame >= sceneOneRayTrajectories[0].length) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      }
    } else if (currClip === 1) {
      let sphericalCoords = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z);
      let newPhi = sphericalCoords.phi + Math.PI / 600.0;
      let newCartesianCoords = sphericalToCartesian(sphericalCoords.r, sphericalCoords.theta, newPhi);
      camera.position.set(newCartesianCoords.x, newCartesianCoords.y, newCartesianCoords.z);
      camera.lookAt(cameraCenter);

      photonSphereMesh.material.opacity = getCurrentOpacity(performance.now() * 0.001, clipStartTime, numPulses, pulseAngularVelocity, pulsePhase, 1.0)

      currClipFrame = currClipFrame + 1;
      if (currClipFrame === numFramesPerClip[currClip]) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      }
    } else if (currClip === 2) {
      if (0.25 <= camera.position.z) {
        camera.position.set(camera.position.x, camera.position.y, camera.position.z - 0.25);
        camera.lookAt(cameraCenter);
      } 

      if (0.02 <= currPhiLength) {
        scene.remove(leftHemisphere);
        scene.remove(rightHemisphere);

        let currPhi = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z).phi;
        let alpha = currPhi - Math.PI / 2.0;
        let beta = alpha + Math.PI;

        currPhiLength -= contractionVelocity;

        leftHemisphere = createSphereMesh(30.0, 0.0, Math.PI, alpha - currPhiLength / 2.0, alpha + currPhiLength / 2.0);
        rightHemisphere = createSphereMesh(30.0, 0.0, Math.PI, beta - currPhiLength / 2.0, beta + currPhiLength / 2.0);

        scene.add(leftHemisphere);
        scene.add(rightHemisphere);
      }

      currClipFrame = currClipFrame + 1;
      if (camera.position.z < 0.25 && currPhiLength < 0.02) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      }
    } else if (currClip === 3) {
      let currSpinValue = Math.abs(spinValues[currPhotonShellKeyframe]);

      if (0.5 < currSpinValue) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      } else {
        scene.remove(photonShellKeyframes[currPhotonShellKeyframe - 1]);
        scene.add(photonShellKeyframes[currPhotonShellKeyframe]);
        if (currClipFrame % 3 == 0) {
          currPhotonShellKeyframe += 1;
        }
        scene.remove(blackHole);
        blackHole = addBlackHole(scene, computeOuterHorizon(currSpinValue));
        spinReadout.innerText = formatNumber(currSpinValue);
        currClipFrame = currClipFrame + 1;
      }
    } else if (currClip === 4) { 
      let sphericalCoords = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z + 0.25);

      camera.position.set(camera.position.x, camera.position.y, camera.position.z + 0.25);
      camera.lookAt(cameraCenter);

      if (Math.PI / 3.0 > sphericalCoords.theta) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      } else {
        currClipFrame = currClipFrame + 1;
      }
    } else if (currClip === 6 || currClip === 8 || currClip === 10) {
      let crossSectionIdx = (currClip === 6) ? 0 : (currClip === 8) ? 1 : 2;

      let sphericalCoords = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z);
      let newPhi = sphericalCoords.phi + Math.PI / 600.0;
      let newCartesianCoords = sphericalToCartesian(sphericalCoords.r, sphericalCoords.theta, newPhi);
      camera.position.set(newCartesianCoords.x, newCartesianCoords.y, newCartesianCoords.z);
      camera.lookAt(cameraCenter);

      photonShellCrossSectionSphericalMeshes[crossSectionIdx].material.opacity = getCurrentOpacity(performance.now() * 0.001, clipStartTime, numPulses, pulseAngularVelocity, pulsePhase, 0.0);
      photonShellCrossSectionLineMeshes[crossSectionIdx].forEach(lineMesh => {
        lineMesh.material.opacity = getCurrentOpacity(performance.now() * 0.001, clipStartTime, numPulses, pulseAngularVelocity, pulsePhase, 0.5)
      })

      for (let i = 0; i <= crossSectionIdx; i++) {
        let posIdx            = photonShellCrossSectionTrajectoryIdxs[i];
        let currRayMeshes     = photonShellCrossSectionRayMeshes[i];
        let currTrails        = photonShellCrossSectionTrails[i];
        let currTrajectories  = photonShellCrossSectionTrajectories[i];
        for (let j = 0; j < currRayMeshes.length; j++) {
          let currMesh        = currRayMeshes[j];
          let currTrail       = currTrails[j];
          let currTrajectory  = currTrajectories[j];

          currMesh.position.set(currTrajectory[posIdx][0], currTrajectory[posIdx][1], currTrajectory[posIdx][2]);
          updateTrail(currMesh, currTrail);
        }
        photonShellCrossSectionTrajectoryIdxs[i] += 1;
      }

      currClipFrame = currClipFrame + 1;
      if (currClipFrame === numFramesPerClip[currClip]) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      }
    } else if (currClip === 5 || currClip === 7 || currClip == 9) {
      let crossSectionIdx = (currClip === 5) ? 0 : (currClip === 7) ? 1 : 2;

      let sphericalCoords = cartesianToSpherical(camera.position.x, camera.position.y, camera.position.z);
      let newPhi = sphericalCoords.phi + Math.PI / 600.0;
      let newCartesianCoords = sphericalToCartesian(sphericalCoords.r, sphericalCoords.theta, newPhi);
      camera.position.set(newCartesianCoords.x, newCartesianCoords.y, newCartesianCoords.z);
      camera.lookAt(cameraCenter);

      for (let i = 0; i <= crossSectionIdx; i++) {
        let posIdx            = photonShellCrossSectionTrajectoryIdxs[i];
        let currRayMeshes     = photonShellCrossSectionRayMeshes[i];
        let currTrails        = photonShellCrossSectionTrails[i];
        let currTrajectories  = photonShellCrossSectionTrajectories[i];
        for (let j = 0; j < currRayMeshes.length; j++) {
          let currMesh        = currRayMeshes[j];
          let currTrail       = currTrails[j];
          let currTrajectory  = currTrajectories[j];

          currMesh.position.set(currTrajectory[posIdx][0], currTrajectory[posIdx][1], currTrajectory[posIdx][2]);
          updateTrail(currMesh, currTrail);
        }
        photonShellCrossSectionTrajectoryIdxs[i] += 1;
      }

      currClipFrame += 1;
      if (currClipFrame > numFramesPerClip[currClip]) {
        currClip = (currClip + 1) % numFramesPerClip.length;
        currClipFrame = 0;
      }
    } else {
      console.log("Clip counter is out of bounds");
    }

	  renderer.render( scene, camera );
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

function addBlackHole(scene, radius) {
  const blackholeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64), 
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );

  scene.add(blackholeMesh);

  return blackholeMesh;
}

function addPhotonSphere(scene, radius) {
  const photonSphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 64, 64), 
    new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true, 
      opacity: 1.0
    })
  );

  scene.add(photonSphereMesh);

  return photonSphereMesh;
}

function addPhotonSphereAzimuthal(scene, radius, phiLength) {
  const photonSphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 
      64, 
      64,
      0.0,
      phiLength,
      0, 
      Math.PI), 
    new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true, 
      opacity: 1.0
    })
  );

  scene.add(photonSphereMesh);

  return photonSphereMesh;
}

function addPhotonSphereStartToEnd(scene, radius, phiStart, phiEnd, currPhi) {
  const photonSphereMesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 
      64, 
      64,
      0.0,
      phiEnd - phiStart,
      0, 
      Math.PI), 
    new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true, 
      opacity: 1.0
    })
  );

  scene.add(photonSphereMesh);
  return photonSphereMesh;
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

function sphericalToCartesian(r, theta, phi) {
    let x = r * Math.sin(theta) * Math.cos(phi);
    let y = r * Math.sin(theta) * Math.sin(phi);
    let z = r * Math.cos(theta);

    return { x, y, z };
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

function rotatePhotonShellKeyframes(cameraPosition, keyframes) {
  const phi = Math.atan2(cameraPosition.y, cameraPosition.x) + (Math.PI / 2.0)
  console.log("rotation: " + String(phi));

  keyframes.forEach((element) => {
    element.rotation.z = phi;
  });
}

/*
*  Returns a promise that resolves with the keyframes array once all keyframes
*  are loaded.
*/
function loadPhotonShellKeyframes() {
  const objLoader = new OBJLoader();
  const lastFrame = 230;
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

function loadPhotonShellCrossSectionsSpin50() {
  const objLoader = new OBJLoader();
  const photonShellCrossSectionsSpin50 = [];
  
  const loadCrossSection = (path) => {
    return new Promise((resolve, reject) => {
      objLoader.load(
        path,
        object => resolve(object),
        undefined,
        error => reject(error)
      );
    });
  };

  const loadAllPhotonShellCrossSections = async () => {
    const paths = [
      "models/photonShellCrossSectionSpin50Radius24.obj",
      "models/photonShellCrossSectionSpin50Radius27.obj",
      "models/photonShellCrossSectionSpin50Radius31.obj"
    ];

    console.log(paths);

    for (let i = 0; i <= paths.length; i++) {
      try {
        const object = await loadCrossSection(paths[i]);
        console.log("successfully loaded " + paths[i]);
        photonShellCrossSectionsSpin50.push(object);
      } catch (error) {
        console.error("Error loading " + paths[i], error);
      }
    }

    return photonShellCrossSectionsSpin50;
  };

  return loadAllPhotonShellCrossSections();
} 

function approximatelyEqual(a, b, epsilon) {
    return Math.abs(a - b) <= epsilon;
}

function computeOuterHorizon(a) {
  return 10.0 * (1 + Math.sqrt(1 - a * a));
}

function setCrossSectionOpacity(object, value) {
  object.traverse(function (child) {
      console.log(child.children);
      console.log(child.children.length);
      if (child.children.length > 0) {
        child.children[0].material.transparent = true;
        child.children[0].material.opacity = value;
      }
  });
}

function createSphereMesh(radius, startTheta, endTheta, startPhi, endPhi) {
  const phiLength = endPhi - startPhi;
  const thetaLength = endTheta - startTheta;
    
  // Ensure the azimuth values are within the range [0, 2 * Math.PI]
  startPhi = (startPhi + 2 * Math.PI) % (2 * Math.PI);
  endPhi = (endPhi + 2 * Math.PI) % (2 * Math.PI);


  const geometry = new THREE.SphereGeometry(
    radius, 
    30, 
    30,
    0.0,
    phiLength,
    startTheta, 
    thetaLength 
  );

  //geometry.rotateX(Math.PI / 2.0);

  const material =  new THREE.MeshBasicMaterial({ 
      color: 0xffffff,
      transparent: true,
      side: THREE.DoubleSide,
      wireframe: true
  })

  const sphereMesh = new THREE.Mesh(geometry, material);

  sphereMesh.rotateZ(Math.PI); // Align the axis to the z-axis
  sphereMesh.updateMatrix;
  sphereMesh.rotateX(Math.PI / 2.0); // Align the axis to the z-axis
  sphereMesh.updateMatrix;
  sphereMesh.rotateY(startPhi); 

  return sphereMesh;
}

function getCurrentOpacity(currClipTime, clipStartTime, numPulses, pulseAngularVelocity, pulsePhase, finalOpacity) {
  const elapsedClipTime = currClipTime - clipStartTime;
  const period = (2.0 * Math.PI) / pulseAngularVelocity;
  const numCycles = elapsedClipTime / period;

  if (numCycles < numPulses) {
    return (Math.sin(pulseAngularVelocity * elapsedClipTime + pulsePhase) + 1.0) / 2.0;
  } else {
    return finalOpacity;
  }
}

function createPhotonSphereLineMesh(rcrit, thetaMinus, thetaPlus, phi) {
  let points = [];
  const numPoints = 1000;

  for (let i = 0; i <= numPoints; i++) {
    const currTheta = thetaMinus + (thetaPlus - thetaMinus) * (i / numPoints);
    const x = rcrit * Math.sin(currTheta) * Math.cos(phi);
    const y = rcrit * Math.sin(currTheta) * Math.sin(phi);
    const z = rcrit * Math.cos(currTheta);

    points.push(new THREE.Vector3(x, y, z));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ 
    color: 0xff0000,
    linewidth: 6,
    transparent: true,
    opacity: 1.0
  });

  material.polygonOffset = true;
  material.polygonOffsetFactor = -10; 
  material.polygonOffsetUnits = -10;

  console.log(material);

  const line = new THREE.Line(geometry, material);

  return line;
}